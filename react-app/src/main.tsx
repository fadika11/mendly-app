import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import "./index.css";

import SplashPage from "./pages/SplashScreen";
import WelcomePage from "./pages/WelcomePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import EmotionalBalancePage from "./pages/EmotionalBalancePage";
import ProfilePage from "./pages/ProfilePage";
import JourneyOverviewPage from "./pages/JourneyOverviewPage";
import ChatPage from "./pages/ChatPage";
import CheckInPage from "./pages/CheckInPage";
import MoodTrackPage from "./pages/MoodTrackPage";
import MoodAnalyzePage from "./pages/MoodAnalyzePage";
import PositiveNotificationsPage from "./pages/PositiveNotificationsPage";
import BreathTrainingPage from "./pages/BreathTrainingPage";
import Breath874Page from "./pages/Breathing478Page";
import DiaphragmaticBreathingPage from "./pages/DiaphragmaticBreathingPage";
import BoxBreathingPage from "./pages/BoxBreathingPage";
import CountingBreathingPage from "./pages/CountingBreathsPage";
import NostrilBreathingPage from "./pages/AlternateNostrilBreathingPage";
import GuidedBreathingPage from "./pages/GuidedVisualizationBreathingPage";
import Phq2Page from "./pages/Phq2Page";
import Phq9Page from "./pages/Phq9Page";
import SupportFinderPage from "./pages/SupportFinderPage";
import PhotoMemoriesPage from "./pages/PhotoMemoriesPage";
import PsychologistHome from "./pages/PsychologistHome";
import PsychologistProfilePage from "./pages/PsychologistProfilePage";
import PsychologistCompleteProfilePage from "./pages/PsychologistCompleteProfilePage";
import PsychologistsDirectoryPage from "./pages/PsychologistsDirectoryPage";
import PsychologistRequestsPage from "./pages/PsychologistRequestsPage";
import PsychologistClientsPage from "./pages/PsychologistClientsPage";
import PsychologistSessionsPage from "./pages/PsychologistSessionsPage";
import ControlCirclePage from "./pages/ControlCirclePage";
import { App as CapacitorApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { setupDailyCheckinNotifications } from "./checkinNotifications";

function NotificationHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    setupDailyCheckinNotifications();

    const setupNotificationClick = async () => {
      LocalNotifications.addListener(
        "localNotificationActionPerformed",
        (event) => {
          const type = event.notification.extra?.type;

          if (type === "audio-listening") {
            const token =
              localStorage.getItem("access_token") || localStorage.getItem("token");

            if (token) {
              navigate("/journey");
            } else {
              navigate("/login", { replace: true });
            }

            return;
          }

          if (type === "checkin") {
            navigate("/check-in");
            return;
          }

          if (type === "positive" || type === "positive-test") {
            navigate("/positive-notifications");
            return;
          }
        }
      );
    };

    setupNotificationClick();

    return () => {
      LocalNotifications.removeAllListeners();
    };
  }, [navigate]);


  useEffect(() => {
    const setupAudioListeningDeepLink = async () => {
      const listener = await CapacitorApp.addListener("appUrlOpen", (event: { url: string; }) => {
        const url = event.url || "";

        if (url.startsWith("mendly://audio-listening")) {
          const token =
            localStorage.getItem("access_token") || localStorage.getItem("token");

          if (token) {
            navigate("/journey");
          } else {
            navigate("/login", { replace: true });
          }
        }
      });

      return listener;
    };

    let listenerRef: { remove: () => Promise<void> } | null = null;

    setupAudioListeningDeepLink().then((listener) => {
      listenerRef = listener;
    });

    return () => {
      if (listenerRef) {
        listenerRef.remove();
      }
    };
  }, [navigate]);

  return null;
}


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <NotificationHandler />

      <Routes>
        <Route path="/" element={<SplashPage />} />

        <Route path="/emotional-balance" element={<EmotionalBalancePage />} />
        <Route path="/welcome" element={<WelcomePage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/journey" element={<JourneyOverviewPage />} />
        <Route path="/control-circle" element={<ControlCirclePage />} />

        <Route path="/psy" element={<PsychologistHome />} />
        <Route path="/psy/profile" element={<PsychologistProfilePage />} />
        <Route path="/psy/complete-profile" element={<PsychologistCompleteProfilePage />} />
        <Route path="/psychologists" element={<PsychologistsDirectoryPage />} />

        <Route path="/chat" element={<ChatPage />} />
        <Route path="/check-in" element={<CheckInPage />} />
        <Route path="/mood-track" element={<MoodTrackPage />} />
        <Route path="/analyze" element={<MoodAnalyzePage />} />
        <Route path="/positive" element={<PositiveNotificationsPage />} />

        <Route path="/breath" element={<BreathTrainingPage />} />
        <Route path="/breathing/8-7-4" element={<Breath874Page />} />
        <Route path="/breathing/diaphragmatic" element={<DiaphragmaticBreathingPage />} />
        <Route path="/breathing/box" element={<BoxBreathingPage />} />
        <Route path="/breathing/counting" element={<CountingBreathingPage />} />
        <Route path="/breathing/alternate-nostril" element={<NostrilBreathingPage />} />
        <Route path="/breathing/visualization" element={<GuidedBreathingPage />} />

        <Route path="/phq2" element={<Phq2Page />} />
        <Route path="/phq9" element={<Phq9Page />} />
        <Route path="/support" element={<SupportFinderPage />} />
        <Route path="/photo-memories" element={<PhotoMemoriesPage />} />

        <Route path="/psy/requests" element={<PsychologistRequestsPage />} />
        <Route path="/psy/clients" element={<PsychologistClientsPage />} />
        <Route path="/psy/sessions" element={<PsychologistSessionsPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);