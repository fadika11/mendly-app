/* ===== Schema: Mendly Core ===== */

IF DB_ID(N'Mendly') IS NULL
BEGIN
    CREATE DATABASE Mendly;
END
GO

USE Mendly;
GO

-- 0) Safety: create schema if needed
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'dbo') EXEC('CREATE SCHEMA dbo');

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

------------------------------------------------------------
-- 1) Users
------------------------------------------------------------
IF OBJECT_ID('dbo.Users','U') IS NOT NULL DROP TABLE dbo.Users;
CREATE TABLE dbo.Users (
    user_id        UNIQUEIDENTIFIER    NOT NULL CONSTRAINT PK_Users PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Username       NVARCHAR(120)       NOT NULL UNIQUE,
    Password       NVARCHAR(256)       NOT NULL,
    Age            SMALLINT            NULL CHECK (Age IS NULL OR (Age BETWEEN 10 AND 120)),
    Gender         TINYINT             NULL CHECK (Gender IN (0,1,2,3)), -- 0=NA,1=F,2=M,3=Other
    is_deleted     BIT                 NOT NULL CONSTRAINT DF_Users_IsDeleted DEFAULT (0),
    created_at     DATETIMEOFFSET      NOT NULL CONSTRAINT DF_Users_Created DEFAULT SYSDATETIMEOFFSET(),
    updated_at     DATETIMEOFFSET      NOT NULL CONSTRAINT DF_Users_Updated DEFAULT SYSDATETIMEOFFSET(),
    Email          NVARCHAR(255)       NOT NULL UNIQUE,
    is_admin       BIT                 NOT NULL CONSTRAINT DF_Users_IsAdmin DEFAULT (0)
);

------------------------------------------------------------
-- 2) UserSettings  (1–1 مع المستخدم)
------------------------------------------------------------
IF OBJECT_ID('dbo.UserSettings','U') IS NOT NULL 
    DROP TABLE dbo.UserSettings;
GO

CREATE TABLE dbo.UserSettings (
    user_id   UNIQUEIDENTIFIER NOT NULL 
              CONSTRAINT PK_UserSettings PRIMARY KEY
              CONSTRAINT FK_UserSettings_Users 
                  FOREIGN KEY REFERENCES dbo.Users(user_id) ON DELETE CASCADE,

    checkin_frequency TINYINT NOT NULL 
        CONSTRAINT DF_UserSettings_Freq DEFAULT (3)
        CONSTRAINT CK_UserSettings_CheckinFreq CHECK (checkin_frequency IN (1,2,3)),

    motivation_enabled BIT NOT NULL 
        CONSTRAINT DF_UserSettings_Motivation DEFAULT (1),

    created_at DATETIMEOFFSET NOT NULL 
        CONSTRAINT DF_UserSettings_Created DEFAULT SYSDATETIMEOFFSET(),

    updated_at DATETIMEOFFSET NOT NULL 
        CONSTRAINT DF_UserSettings_Updated DEFAULT SYSDATETIMEOFFSET(),

    positive_notif_enabled BIT NOT NULL 
        CONSTRAINT DF_UserSettings_PosNotifEnabled DEFAULT (1),

    positive_notif_interval_minutes INT NOT NULL 
        CONSTRAINT DF_UserSettings_PosNotifInterval DEFAULT (60),

    last_phq2_date DATE NULL,

    last_photo_memory_date DATE NULL
);
GO

------------------------------------------------------------
-- 3) UserDeviceTokens  (جديد موصى به لـ FCM)
------------------------------------------------------------
IF OBJECT_ID('dbo.UserDeviceTokens','U') IS NOT NULL DROP TABLE dbo.UserDeviceTokens;
CREATE TABLE dbo.UserDeviceTokens (
    token_id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_UserDeviceTokens PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    user_id         UNIQUEIDENTIFIER NOT NULL
                      CONSTRAINT FK_UserDeviceTokens_Users FOREIGN KEY REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
    platform        NVARCHAR(20)     NOT NULL CHECK (platform IN (N'android',N'ios')),
    fcm_token       NVARCHAR(512)    NOT NULL UNIQUE,
    app_version     NVARCHAR(20)     NULL,
    last_seen       DATETIMEOFFSET   NOT NULL CONSTRAINT DF_UserDeviceTokens_LastSeen DEFAULT SYSDATETIMEOFFSET(),
    is_active       BIT              NOT NULL CONSTRAINT DF_UserDeviceTokens_Active DEFAULT (1)
);
CREATE INDEX IX_UserDeviceTokens_User ON dbo.UserDeviceTokens(user_id, is_active);

------------------------------------------------------------
-- 4) CheckinSchedule
------------------------------------------------------------
IF OBJECT_ID('dbo.CheckinSchedule','U') IS NOT NULL DROP TABLE dbo.CheckinSchedule;
CREATE TABLE dbo.CheckinSchedule (
    schedule_id     UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CheckinSchedule PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    user_id         UNIQUEIDENTIFIER NOT NULL
                      CONSTRAINT FK_CheckinSchedule_Users FOREIGN KEY REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
    slot_name       NVARCHAR(20)     NOT NULL CHECK (slot_name IN (N'morning',N'noon',N'evening')),
    local_hour      TINYINT          NOT NULL CHECK (local_hour BETWEEN 0 AND 23),
    local_minute    TINYINT          NOT NULL CHECK (local_minute BETWEEN 0 AND 59),
    enabled         BIT              NOT NULL CONSTRAINT DF_CheckinSchedule_Enabled DEFAULT (1),
    created_at      DATETIMEOFFSET   NOT NULL CONSTRAINT DF_CheckinSchedule_Created DEFAULT SYSDATETIMEOFFSET(),
    updated_at      DATETIMEOFFSET   NOT NULL CONSTRAINT DF_CheckinSchedule_Updated DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT UQ_CheckinSchedule_UserSlot UNIQUE (user_id, slot_name)
);
GO

------------------------------------------------------------
-- Trigger: after insert on Users -> seed UserSettings + CheckinSchedule
------------------------------------------------------------
GO
CREATE OR ALTER TRIGGER dbo.trg_Users_SeedCheckins
ON dbo.Users
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.UserSettings (user_id)
    SELECT i.user_id
    FROM inserted i
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.UserSettings s
        WHERE s.user_id = i.user_id
    );

    INSERT INTO dbo.CheckinSchedule (user_id, slot_name, local_hour, local_minute)
    SELECT 
        i.user_id,
        v.slot_name,
        v.local_hour,
        v.local_minute
    FROM inserted i
    CROSS JOIN (VALUES
        (N'morning', 9, 0),
        (N'noon',    14, 0),
        (N'evening', 21, 0)
    ) AS v(slot_name, local_hour, local_minute)
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.CheckinSchedule c
        WHERE c.user_id   = i.user_id
          AND c.slot_name = v.slot_name
    );
END;
GO


------------------------------------------------------------
-- 5) MoodEntries
------------------------------------------------------------
IF OBJECT_ID('dbo.MoodEntries','U') IS NOT NULL DROP TABLE dbo.MoodEntries;
CREATE TABLE dbo.MoodEntries (
    mood_id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_MoodEntries PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    user_id             UNIQUEIDENTIFIER NOT NULL
                          CONSTRAINT FK_MoodEntries_Users FOREIGN KEY REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
    checkin_slot        NVARCHAR(20)     NULL CHECK (checkin_slot IS NULL OR checkin_slot IN (N'morning',N'noon',N'evening')),
    score               TINYINT          NOT NULL CHECK (score BETWEEN 0 AND 10),
    label               NVARCHAR(40)     NULL,
    text_note_encrypted VARBINARY(MAX)   NULL,
    emojis_json         NVARCHAR(MAX)    NULL,
    captured_at         DATETIMEOFFSET   NOT NULL,
    created_at          DATETIMEOFFSET   NOT NULL CONSTRAINT DF_MoodEntries_Created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX IX_MoodEntries_User_Time ON dbo.MoodEntries(user_id, captured_at DESC);

------------------------------------------------------------
-- 6) Recommendations
------------------------------------------------------------
IF OBJECT_ID('dbo.Recommendations','U') IS NOT NULL DROP TABLE dbo.Recommendations;
CREATE TABLE dbo.Recommendations (
    rec_id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Recommendations PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    user_id         UNIQUEIDENTIFIER NOT NULL
                      CONSTRAINT FK_Recommendations_Users FOREIGN KEY REFERENCES dbo.Users(user_id),
    mood_id         UNIQUEIDENTIFIER NULL
                      CONSTRAINT FK_Recommendations_MoodEntries FOREIGN KEY REFERENCES dbo.MoodEntries(mood_id) ON DELETE SET NULL,
    rec_type        NVARCHAR(40)     NOT NULL,
    title           NVARCHAR(200)    NOT NULL,
    body            NVARCHAR(MAX)    NOT NULL,
    lang            CHAR(2)          NOT NULL CONSTRAINT DF_Recommendations_Lang DEFAULT ('en') CHECK (lang IN ('ar','he','en')),
    user_action     NVARCHAR(20)     NULL CHECK (user_action IN (N'opened',N'saved',N'dismissed',N'completed')),
    shown_at        DATETIMEOFFSET   NULL,  -- إن رغبتِ بتوثيق وقت العرض
    created_at      DATETIMEOFFSET   NOT NULL CONSTRAINT DF_Recommendations_Created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX IX_Recommendations_User_Created ON dbo.Recommendations(user_id, created_at DESC);

------------------------------------------------------------
-- 7) MotivationalContent
------------------------------------------------------------
IF OBJECT_ID('dbo.MotivationalContent','U') IS NOT NULL DROP TABLE dbo.MotivationalContent;
CREATE TABLE dbo.MotivationalContent (
    content_id      UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_MotivationalContent PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    lang            CHAR(2)          NOT NULL CHECK (lang IN ('ar','he','en')),
    text            NVARCHAR(MAX)    NOT NULL,
    topic           NVARCHAR(40)     NULL,
    is_active       BIT              NOT NULL CONSTRAINT DF_MotivationalContent_Active DEFAULT (1)
);
CREATE INDEX IX_MotivationalContent_Lang ON dbo.MotivationalContent(lang, is_active);

------------------------------------------------------------
-- 8) MendsCatalog (موصى به كمصدر توصيات ثابتة)
------------------------------------------------------------
IF OBJECT_ID('dbo.MendsCatalog','U') IS NOT NULL DROP TABLE dbo.MendsCatalog;
CREATE TABLE dbo.MendsCatalog (
    mend_id     UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_MendsCatalog PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    rec_type    NVARCHAR(40)     NOT NULL,
    title       NVARCHAR(200)    NOT NULL,
    body        NVARCHAR(MAX)    NOT NULL,
    lang        CHAR(2)          NOT NULL CHECK (lang IN ('ar','he','en')),
    tags        NVARCHAR(200)    NULL,
    is_active   BIT              NOT NULL CONSTRAINT DF_MendsCatalog_Active DEFAULT (1)
);

------------------------------------------------------------
-- 9) AuditLogs
------------------------------------------------------------
IF OBJECT_ID('dbo.AuditLogs','U') IS NOT NULL DROP TABLE dbo.AuditLogs;
CREATE TABLE dbo.AuditLogs (
    audit_id    BIGINT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_AuditLogs PRIMARY KEY,
    user_id     UNIQUEIDENTIFIER NULL
                   CONSTRAINT FK_AuditLogs_Users FOREIGN KEY REFERENCES dbo.Users(user_id) ON DELETE SET NULL,
    actor       NVARCHAR(40)     NOT NULL,  -- system/api/user
    action      NVARCHAR(80)     NOT NULL,
    resource    NVARCHAR(120)    NULL,
    ts          DATETIMEOFFSET   NOT NULL CONSTRAINT DF_AuditLogs_Ts DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX IX_AuditLogs_User_Ts ON dbo.AuditLogs(user_id, ts DESC);

------------------------------------------------------------
-- 10) NotificationQueue
------------------------------------------------------------
IF OBJECT_ID('dbo.NotificationQueue','U') IS NOT NULL DROP TABLE dbo.NotificationQueue;
CREATE TABLE dbo.NotificationQueue (
    job_id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NotificationQueue PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    user_id         UNIQUEIDENTIFIER NOT NULL
                      CONSTRAINT FK_NotificationQueue_Users FOREIGN KEY REFERENCES dbo.Users(user_id),
    token_id        UNIQUEIDENTIFIER NULL
                      CONSTRAINT FK_NotificationQueue_Device FOREIGN KEY REFERENCES dbo.UserDeviceTokens(token_id) ON DELETE SET NULL,
    purpose         NVARCHAR(40)     NOT NULL CHECK (purpose IN (N'checkin_reminder',N'tip',N'weekly_summary')),
    payload_json    NVARCHAR(MAX)    NOT NULL,
    scheduled_at    DATETIMEOFFSET   NOT NULL,
    sent_at         DATETIMEOFFSET   NULL,
    status          NVARCHAR(20)     NOT NULL CONSTRAINT DF_NotificationQueue_Status DEFAULT (N'pending')
                       CHECK (status IN (N'pending',N'sent',N'failed')),
    error           NVARCHAR(500)    NULL
);
CREATE INDEX IX_NotificationQueue_Status_Sched ON dbo.NotificationQueue(status, scheduled_at);
GO

------------------------------------------------------------
-- Stored procedure: enqueue daily check-in reminders
------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.EnqueueDailyCheckinReminders
    @slot_name NVARCHAR(20)   -- 'morning' / 'noon' / 'evening'
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @now   DATETIMEOFFSET = SYSDATETIMEOFFSET();
    DECLARE @today DATE           = CONVERT(date, @now);

    INSERT INTO dbo.NotificationQueue (
          user_id,
          token_id,
          purpose,
          payload_json,
          scheduled_at,
          status
    )
    SELECT
        cs.user_id,
        NULL,  
        N'checkin_reminder',
        N'{
            "slot": "' + @slot_name + N'",
            "title": "Mendly check-in",
            "body":  "Take 30 seconds to log your ' + @slot_name + N' mood today."
          }',
        @now,
        N'pending'
    FROM dbo.CheckinSchedule cs
    WHERE cs.enabled   = 1
      AND cs.slot_name = @slot_name
      -- avoid duplicate reminders for same user/slot/date
      AND NOT EXISTS (
            SELECT 1
            FROM dbo.NotificationQueue q
            WHERE q.user_id  = cs.user_id
              AND q.purpose  = N'checkin_reminder'
              AND CONVERT(date, q.scheduled_at) = @today
              AND q.payload_json LIKE '%"slot":"' + @slot_name + '"%'
      );
END
GO

------------------------------------------------------------
-- NEW: Stored procedure: enqueue positive notifications (tips)
-- One "tip" per user per day, for users with positive_notif_enabled = 1
------------------------------------------------------------
CREATE OR ALTER PROCEDURE dbo.EnqueuePositiveNotifications
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @now   DATETIMEOFFSET = SYSDATETIMEOFFSET();
    DECLARE @today DATE           = CONVERT(date, @now);

    INSERT INTO dbo.NotificationQueue (
          user_id,
          token_id,
          purpose,
          payload_json,
          scheduled_at,
          status
    )
    SELECT
        s.user_id,
        NULL,  
        N'tip',
        N'{
            "title": "Mendly \u2022 A small positive moment",
            "body":  "Take one small positive pause with Mendly today."
          }',
        @now,
        N'pending'
    FROM dbo.UserSettings s
    WHERE s.positive_notif_enabled = 1
      AND NOT EXISTS (
            SELECT 1
            FROM dbo.NotificationQueue q
            WHERE q.user_id = s.user_id
              AND q.purpose = N'tip'
              AND CONVERT(date, q.scheduled_at) = @today
      );
END
GO

------------------------------------------------------------
-- 11) AdherenceStats
------------------------------------------------------------
IF OBJECT_ID('dbo.AdherenceStats','U') IS NOT NULL DROP TABLE dbo.AdherenceStats;
CREATE TABLE dbo.AdherenceStats (
    user_id         UNIQUEIDENTIFIER NOT NULL
                      CONSTRAINT PK_AdherenceStats PRIMARY KEY
                      CONSTRAINT FK_AdherenceStats_Users FOREIGN KEY REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
    streak_days     INT              NOT NULL CONSTRAINT DF_AdherenceStats_Streak DEFAULT (0),
    last_checkin_at DATETIMEOFFSET   NULL,
    avg_7d          DECIMAL(4,2)     NULL,
    avg_14d         DECIMAL(4,2)     NULL,
    avg_30d         DECIMAL(4,2)     NULL,
    updated_at      DATETIMEOFFSET   NOT NULL CONSTRAINT DF_AdherenceStats_Updated DEFAULT SYSDATETIMEOFFSET()
);

------------------------------------------------------------
-- 12) Exports
------------------------------------------------------------
IF OBJECT_ID('dbo.Exports','U') IS NOT NULL DROP TABLE dbo.Exports;
CREATE TABLE dbo.Exports (
    export_id       UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Exports PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    user_id         UNIQUEIDENTIFIER NOT NULL
                      CONSTRAINT FK_Exports_Users FOREIGN KEY REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
    format          NVARCHAR(20)     NOT NULL CHECK (format IN (N'pdf',N'csv',N'json')),
    presigned_url   NVARCHAR(512)    NULL,
    status          NVARCHAR(20)     NOT NULL CHECK (status IN (N'requested',N'ready',N'expired')),
    requested_at    DATETIMEOFFSET   NOT NULL,
    ready_at        DATETIMEOFFSET   NULL,
    expires_at      DATETIMEOFFSET   NULL
);
CREATE INDEX IX_Exports_User_Status ON dbo.Exports(user_id, status);

------------------------------------------------------------
-- 13) Consents  (موصى به)
------------------------------------------------------------
IF OBJECT_ID('dbo.Consents','U') IS NOT NULL DROP TABLE dbo.Consents;
CREATE TABLE dbo.Consents (
    consent_id      UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Consents PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    user_id         UNIQUEIDENTIFIER NOT NULL
                      CONSTRAINT FK_Consents_Users FOREIGN KEY REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
    policy_version  NVARCHAR(20)     NOT NULL,
    granted         BIT              NOT NULL,
    granted_at      DATETIMEOFFSET   NOT NULL,
    CONSTRAINT UQ_Consents_UserVersion UNIQUE (user_id, policy_version)
);

------------------------------------------------------------
-- 14) DataDeletionRequests  (موصى به)
------------------------------------------------------------
IF OBJECT_ID('dbo.DataDeletionRequests','U') IS NOT NULL DROP TABLE dbo.DataDeletionRequests;
CREATE TABLE dbo.DataDeletionRequests (
    request_id      UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_DataDeletionRequests PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    user_id         UNIQUEIDENTIFIER NOT NULL
                      CONSTRAINT FK_DataDeletionRequests_Users FOREIGN KEY REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
    status          NVARCHAR(20)     NOT NULL CHECK (status IN (N'open',N'processing',N'done')),
    requested_at    DATETIMEOFFSET   NOT NULL,
    processed_at    DATETIMEOFFSET   NULL,
    notes           NVARCHAR(MAX)    NULL
);
CREATE INDEX IX_DataDeletionRequests_Status ON dbo.DataDeletionRequests(status, requested_at);

------------------------------------------------------------
-- 15) AIInteractions  (موصى به)
------------------------------------------------------------
IF OBJECT_ID('dbo.AIInteractions','U') IS NOT NULL DROP TABLE dbo.AIInteractions;
CREATE TABLE dbo.AIInteractions (
    ai_id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_AIInteractions PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    user_id         UNIQUEIDENTIFIER NULL
                      CONSTRAINT FK_AIInteractions_Users FOREIGN KEY REFERENCES dbo.Users(user_id),
    mood_id         UNIQUEIDENTIFIER NULL
                      CONSTRAINT FK_AIInteractions_MoodEntries FOREIGN KEY REFERENCES dbo.MoodEntries(mood_id) ON DELETE SET NULL,
    purpose         NVARCHAR(40)     NOT NULL CHECK (purpose IN (N'recommendation',N'summary')),
    prompt_hash     VARBINARY(32)    NULL,  -- بدلاً من تخزين نص الحسّاس
    input_refs_json NVARCHAR(MAX)    NULL,  -- IDs بدل نصوص
    output_text     NVARCHAR(MAX)    NOT NULL,
    created_at      DATETIMEOFFSET   NOT NULL CONSTRAINT DF_AIInteractions_Created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX IX_AIInteractions_User_Time ON dbo.AIInteractions(user_id, created_at DESC);
GO

------------------------------------------------------------
-- 16) HappyMemories: user's positive photo memories 
------------------------------------------------------------
IF OBJECT_ID('dbo.HappyMemories','U') IS NOT NULL DROP TABLE dbo.HappyMemories;
CREATE TABLE dbo.HappyMemories (
    memory_id      UNIQUEIDENTIFIER NOT NULL 
                     CONSTRAINT PK_HappyMemories PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    user_id        UNIQUEIDENTIFIER NOT NULL
                     CONSTRAINT FK_HappyMemories_Users FOREIGN KEY REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
    image_url      NVARCHAR(512)    NOT NULL,     
    caption        NVARCHAR(300)    NULL,
    memory_date    DATE             NULL,         
    created_at     DATETIMEOFFSET   NOT NULL CONSTRAINT DF_HappyMemories_Created DEFAULT SYSDATETIMEOFFSET()
);
GO

CREATE INDEX IX_HappyMemories_User ON dbo.HappyMemories(user_id, created_at DESC);
GO


------------------------------------------------------------
-- 17) AiChatMessages
------------------------------------------------------------
IF OBJECT_ID('dbo.AiChatMessages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AiChatMessages (
        chat_message_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        user_id UNIQUEIDENTIFIER NOT NULL,
        role NVARCHAR(20) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );

    CREATE INDEX IX_AiChatMessages_UserCreatedAt
        ON dbo.AiChatMessages(user_id, created_at);
END
GO


/* ===== Seed: Admin User (safe to re-run) ===== */
BEGIN TRY
    BEGIN TRAN;

    -- bcrypt hash for "admin123"
    DECLARE @adminHash NVARCHAR(256) = N'$2b$10$LiqjcT47bk/ycccIoDAOeeoTS8Eko2PTmGK21Bpsa./tLggkeb6U6';

    -- Insert admin if missing; capture the generated user_id (GUID)
    DECLARE @ins TABLE (user_id UNIQUEIDENTIFIER);

    IF NOT EXISTS (
        SELECT 1 FROM dbo.Users
        WHERE Username = N'admin' OR Email = N'admin@gmail.com'
    )
    BEGIN
        INSERT INTO dbo.Users (Username, Email, Password, Age, Gender, is_admin)
        OUTPUT inserted.user_id INTO @ins
        VALUES (N'admin', N'admin@gmail.com', @adminHash, 22, 2, 1); -- Gender=2 (male), is_admin=1
    END
    ELSE
    BEGIN
        -- ensure existing admin account is marked as admin
        UPDATE dbo.Users
        SET is_admin = 1,
            updated_at = SYSDATETIMEOFFSET()
        WHERE (Username = N'admin' OR Email = N'admin@gmail.com') AND is_admin = 0;
    END

    DECLARE @adminId UNIQUEIDENTIFIER =
        COALESCE(
            (SELECT TOP 1 user_id FROM @ins),
            (SELECT TOP 1 user_id FROM dbo.Users WHERE Username = N'admin' OR Email = N'admin@gmail.com')
        );

    -- Optional: ensure a UserSettings row exists for admin (uses defaults)
    IF @adminId IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.UserSettings WHERE user_id = @adminId)
    BEGIN
        INSERT INTO dbo.UserSettings (user_id) VALUES (@adminId);
    END

    -- Optional: log the seed
    IF @adminId IS NOT NULL
    BEGIN
        INSERT INTO dbo.AuditLogs (user_id, actor, action, resource)
        VALUES (@adminId, N'system', N'seed', N'Users.admin');
    END

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;


------------------------------------------------------------
-- 18) ControlCirclePrompts
-- Default worry/thought cards for Circle of Control feature
------------------------------------------------------------
IF OBJECT_ID('dbo.ControlCirclePrompts','U') IS NOT NULL
    DROP TABLE dbo.ControlCirclePrompts;
GO

CREATE TABLE dbo.ControlCirclePrompts (
    prompt_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_ControlCirclePrompts PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    label NVARCHAR(120) NOT NULL,
    category_hint NVARCHAR(40) NULL,

    can_control_message NVARCHAR(700) NOT NULL,
    cannot_control_message NVARCHAR(700) NOT NULL,

    is_active BIT NOT NULL
        CONSTRAINT DF_ControlCirclePrompts_IsActive DEFAULT (1),

    created_at DATETIMEOFFSET NOT NULL
        CONSTRAINT DF_ControlCirclePrompts_Created DEFAULT SYSDATETIMEOFFSET()
);
GO

CREATE UNIQUE INDEX UQ_ControlCirclePrompts_Label
ON dbo.ControlCirclePrompts(label);
GO


------------------------------------------------------------
-- 19) UserControlCircleEntries
-- Saves what the user dragged into the control/cannot-control circle
------------------------------------------------------------
IF OBJECT_ID('dbo.UserControlCircleEntries','U') IS NOT NULL
    DROP TABLE dbo.UserControlCircleEntries;
GO

CREATE TABLE dbo.UserControlCircleEntries (
    entry_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_UserControlCircleEntries PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    user_id UNIQUEIDENTIFIER NOT NULL,
    prompt_id UNIQUEIDENTIFIER NULL,

    prompt_text NVARCHAR(200) NOT NULL,

    selected_zone NVARCHAR(30) NOT NULL,
    -- can_control / cannot_control

    feedback_message NVARCHAR(900) NOT NULL,

    created_at DATETIMEOFFSET NOT NULL
        CONSTRAINT DF_UserControlCircleEntries_Created DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT FK_UserControlCircleEntries_Users
        FOREIGN KEY (user_id)
        REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT FK_UserControlCircleEntries_Prompt
        FOREIGN KEY (prompt_id)
        REFERENCES dbo.ControlCirclePrompts(prompt_id),

    CONSTRAINT CK_UserControlCircleEntries_Zone
        CHECK (selected_zone IN (N'can_control', N'cannot_control'))
);
GO

CREATE INDEX IX_UserControlCircleEntries_UserCreated
ON dbo.UserControlCircleEntries(user_id, created_at DESC);
GO


------------------------------------------------------------
-- Seed Circle of Control prompts
------------------------------------------------------------
INSERT INTO dbo.ControlCirclePrompts
(label, category_hint, can_control_message, cannot_control_message)
VALUES
(
    N'Fear of the future',
    N'anxiety',
    N'Choose one small action for today: plan your next hour, talk to someone you trust, or take a short breathing pause.',
    N'You cannot know everything about the future right now. Try to bring your attention back to one safe step you can take today.'
),
(
    N'Uncertainty',
    N'anxiety',
    N'You can control how you respond to uncertainty: make a simple plan, write down what you know, and choose one next step.',
    N'Uncertainty is uncomfortable, but you do not need to solve everything at once. Focus on what is true and helpful right now.'
),
(
    N'Loss of control',
    N'anxiety',
    N'Pick one small controllable action: drink water, organize your space, send a message, or do one minute of breathing.',
    N'Some things are outside your control. You can still support your body and mind in this moment.'
),
(
    N'News overload',
    N'stress',
    N'You can limit news checking today. Try choosing one or two specific times to check updates, then return to something calming.',
    N'You cannot control every update or event. It is okay to step away from news when your mind needs rest.'
),
(
    N'Safety concerns',
    N'safety',
    N'Focus on practical safety steps you can do now: know your safe place, keep your phone charged, and stay connected with trusted people.',
    N'You may not control every outside situation, but you can remind yourself of the safety steps already available to you.'
),
(
    N'Overthinking',
    N'anxiety',
    N'Write down the thought, then choose one action. Even a tiny action can help your mind feel less stuck.',
    N'You do not need to answer every thought. Some thoughts can pass without needing a full solution.'
),
(
    N'Waiting for updates',
    N'stress',
    N'Set a time to check updates, then do something grounding while you wait: breathing, stretching, or talking to someone.',
    N'Waiting can feel hard. You cannot force answers to arrive faster, but you can care for yourself while waiting.'
),
(
    N'Feeling unsafe',
    N'safety',
    N'Focus on immediate support: move to a safer space, contact someone you trust, or use a calming exercise.',
    N'You may not control everything around you, but you can choose one step that helps you feel more supported right now.'
),
(
    N'School pressure',
    N'stress',
    N'Choose one school task you can start with today. A small step, like reviewing one page or writing one paragraph, is still progress.',
    N'You cannot control every result immediately. Focus on preparation, rest, and one task at a time.'
),
(
    N'Family tension',
    N'relationships',
    N'You can control how you respond. Try speaking calmly, taking a pause, or choosing the right time to talk.',
    N'You cannot control every person’s reaction. You can still protect your peace and choose a respectful response.'
),
(
    N'Feeling overwhelmed',
    N'anxiety',
    N'Pick only one thing to do next. When everything feels too much, one small action is enough to begin.',
    N'You do not need to solve everything right now. Give yourself permission to slow down.'
),
(
    N'Loneliness',
    N'emotions',
    N'You can take one connection step today: message someone, sit near family, or join a small activity.',
    N'You cannot force connection instantly, but you can gently create chances for support.'
),
(
    N'Too many thoughts',
    N'anxiety',
    N'Write down the thoughts and circle only one that needs action today. The rest can wait.',
    N'You do not have to answer every thought. Some thoughts can pass without needing your attention.'
),
(
    N'Making mistakes',
    N'self-confidence',
    N'You can learn from one mistake without judging your whole self. Try asking: what can this teach me?',
    N'You cannot be perfect all the time. Mistakes are part of learning, not proof that you failed.'
),
(
    N'Health worries',
    N'anxiety',
    N'You can take practical steps: rest, drink water, ask for help, or contact a trusted adult or professional if needed.',
    N'You cannot control every body signal. Try not to fight the worry alone; focus on safe support.'
),
(
    N'Social pressure',
    N'relationships',
    N'You can choose your boundaries. It is okay to say no, take space, or choose people who respect you.',
    N'You cannot control what everyone thinks. Your worth is not decided by other people’s opinions.'
),
(
    N'Feeling behind',
    N'stress',
    N'Choose one small step that moves you forward today. Progress does not need to be huge to count.',
    N'You cannot change yesterday, but you can start from where you are now.'
),
(
    N'Bad mood',
    N'mood',
    N'You can support your mood with one gentle action: breathing, music, movement, water, or talking to someone.',
    N'You do not have to force yourself to feel happy. Feelings can change with time and care.'
),
(
    N'Sleep problems',
    N'health',
    N'You can support your sleep tonight with one small routine: dim the screen, breathe slowly, or prepare your bed earlier.',
    N'You cannot force sleep immediately. Resting your body still matters, even if sleep takes time.'
),
(
    N'Exams',
    N'stress',
    N'Choose one focused study block today. Even 20 minutes of review can help you feel more prepared.',
    N'You cannot control every exam question. You can control preparation, breaks, and asking for help when needed.'
),
(
    N'Arguments',
    N'relationships',
    N'You can choose your tone, take a pause, and come back to the conversation when you feel calmer.',
    N'You cannot fully control how another person reacts. You can still protect your peace and respond with care.'
),
(
    N'Feeling judged',
    N'self-confidence',
    N'You can remind yourself of what is true about you, not only what others might think.',
    N'You cannot control every opinion. Other people’s thoughts do not define your worth.'
),
(
    N'Big decisions',
    N'stress',
    N'Break the decision into smaller parts: what do you know, what do you need, and who can help you think clearly?',
    N'You cannot know every outcome before choosing. It is okay to take the next step with the information you have.'
),
(
    N'Missing someone',
    N'emotions',
    N'You can honor the feeling by writing a message, looking at a memory, or talking to someone supportive.',
    N'You cannot always change distance or time. It is okay to miss someone and still care for yourself today.'
);
GO


------------------------------------------------------------
-- 18) AppointmentIntakes
------------------------------------------------------------
IF OBJECT_ID('dbo.AppointmentIntakes','U') IS NOT NULL
    DROP TABLE dbo.AppointmentIntakes;
GO

CREATE TABLE dbo.AppointmentIntakes (
    intake_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_AppointmentIntakes PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    client_user_id UNIQUEIDENTIFIER NOT NULL,
    psychologist_user_id UNIQUEIDENTIFIER NOT NULL,

    answers_json NVARCHAR(MAX) NOT NULL,

    created_at DATETIMEOFFSET NOT NULL
        CONSTRAINT DF_AppointmentIntakes_Created DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT FK_Intakes_Client
        FOREIGN KEY (client_user_id)
        REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT FK_Intakes_Psychologist
        FOREIGN KEY (psychologist_user_id)
        REFERENCES dbo.Users(user_id)
);
GO


------------------------------------------------------------
-- 19) Appointments
------------------------------------------------------------
IF OBJECT_ID('dbo.Appointments','U') IS NOT NULL
    DROP TABLE dbo.Appointments;
GO

CREATE TABLE dbo.Appointments (
    appointment_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_Appointments PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    client_user_id UNIQUEIDENTIFIER NOT NULL,
    psychologist_user_id UNIQUEIDENTIFIER NOT NULL,

    intake_id UNIQUEIDENTIFIER NULL,
    start_at DATETIMEOFFSET NOT NULL,

    status NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Appointments_Status DEFAULT ('requested'),

    notes NVARCHAR(500) NULL,

    created_at DATETIMEOFFSET NOT NULL
        CONSTRAINT DF_Appointments_Created DEFAULT SYSDATETIMEOFFSET(),

    updated_at DATETIMEOFFSET NULL,

    availability_slot_id UNIQUEIDENTIFIER NULL,

    CONSTRAINT CK_Appointments_Status
        CHECK (status IN (N'requested', N'approved', N'rejected', N'canceled', N'completed')),

    CONSTRAINT FK_Appointments_Client
        FOREIGN KEY (client_user_id)
        REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT FK_Appointments_Psychologist
        FOREIGN KEY (psychologist_user_id)
        REFERENCES dbo.Users(user_id),

    CONSTRAINT FK_Appointments_Intake
        FOREIGN KEY (intake_id)
        REFERENCES dbo.AppointmentIntakes(intake_id)
);
GO


------------------------------------------------------------
-- 20) PsychologistAvailabilitySlots
-- Saved available appointment times for psychologists
------------------------------------------------------------
IF OBJECT_ID('dbo.PsychologistAvailabilitySlots','U') IS NOT NULL
    DROP TABLE dbo.PsychologistAvailabilitySlots;
GO

CREATE TABLE dbo.PsychologistAvailabilitySlots (
    slot_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_PsychologistAvailabilitySlots PRIMARY KEY
        DEFAULT NEWSEQUENTIALID(),

    psychologist_user_id UNIQUEIDENTIFIER NOT NULL,

    start_at DATETIMEOFFSET NOT NULL,
    end_at DATETIMEOFFSET NULL,

    is_booked BIT NOT NULL
        CONSTRAINT DF_PsychologistAvailabilitySlots_IsBooked DEFAULT (0),

    appointment_id UNIQUEIDENTIFIER NULL,

    created_at DATETIMEOFFSET NOT NULL
        CONSTRAINT DF_PsychologistAvailabilitySlots_Created DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT FK_PsychologistAvailabilitySlots_Psychologist
        FOREIGN KEY (psychologist_user_id)
        REFERENCES dbo.Users(user_id),

    CONSTRAINT FK_PsychologistAvailabilitySlots_Appointment
        FOREIGN KEY (appointment_id)
        REFERENCES dbo.Appointments(appointment_id)
);
GO


------------------------------------------------------------
-- 22) Appointment indexes
------------------------------------------------------------
CREATE UNIQUE INDEX UQ_PsychologistAvailabilitySlots_PsyStart
ON dbo.PsychologistAvailabilitySlots(psychologist_user_id, start_at);
GO

CREATE INDEX IX_PsychologistAvailabilitySlots_PsyDateBooked
ON dbo.PsychologistAvailabilitySlots(psychologist_user_id, start_at, is_booked);
GO

CREATE INDEX IX_Appointments_Psy
ON dbo.Appointments(psychologist_user_id, status, start_at);
GO

CREATE INDEX IX_Appointments_Client
ON dbo.Appointments(client_user_id, status, start_at);
GO

CREATE INDEX IX_Intakes_Psy
ON dbo.AppointmentIntakes(psychologist_user_id, created_at);
GO


------------------------------------------------------------
-- 23) Add Role column to Users
------------------------------------------------------------
IF COL_LENGTH('dbo.Users', 'Role') IS NULL
BEGIN
    ALTER TABLE dbo.Users
    ADD Role NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Users_Role DEFAULT ('regular');
END
GO


------------------------------------------------------------
-- 24) PsychologistProfiles
------------------------------------------------------------
IF OBJECT_ID('dbo.PsychologistProfiles','U') IS NOT NULL
    DROP TABLE dbo.PsychologistProfiles;
GO

CREATE TABLE dbo.PsychologistProfiles (
    user_id UNIQUEIDENTIFIER NOT NULL
        CONSTRAINT PK_PsychologistProfiles PRIMARY KEY,

    specialty NVARCHAR(120) NOT NULL,
    workplace NVARCHAR(200) NULL,
    city NVARCHAR(120) NULL,
    bio NVARCHAR(500) NULL,
    years_experience INT NULL,
    license_number NVARCHAR(80) NULL,

    CONSTRAINT FK_PsychologistProfiles_Users
        FOREIGN KEY (user_id)
        REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE
);
GO

