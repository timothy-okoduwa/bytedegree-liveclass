// firebase-api.js
import {
  collection,
  doc,
  addDoc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase-config";

// No token needed for Firebase
export const getToken = async () => {
  // Return null since we don't need VideoSDK tokens anymore
  return null;
};

// Create a new meeting room in Firestore
export const createMeeting = async ({ token }) => {
  try {
    // Create a new meeting document
    const meetingRef = await addDoc(collection(db, "meetings"), {
      createdAt: serverTimestamp(),
      status: "active",
      participants: {},
      settings: {
        recording: false,
        screenshare: false,
      },
    });

    return {
      meetingId: meetingRef.id,
      err: null,
    };
  } catch (error) {
    console.error("Error creating meeting:", error);
    return {
      meetingId: null,
      err: error.message,
    };
  }
};

// Validate if a meeting exists
export const validateMeeting = async ({ roomId, token }) => {
  try {
    const meetingRef = doc(db, "meetings", roomId);
    const meetingSnap = await getDoc(meetingRef);

    if (meetingSnap.exists()) {
      const meetingData = meetingSnap.data();

      // Check if meeting is still active
      if (meetingData.status === "active") {
        return {
          meetingId: roomId,
          err: null,
        };
      } else {
        return {
          meetingId: null,
          err: "Meeting has ended",
        };
      }
    } else {
      return {
        meetingId: null,
        err: "Meeting not found",
      };
    }
  } catch (error) {
    console.error("Error validating meeting:", error);
    return {
      meetingId: null,
      err: error.message,
    };
  }
};

// Helper function to end a meeting
export const endMeeting = async (meetingId) => {
  try {
    const meetingRef = doc(db, "meetings", meetingId);
    await setDoc(
      meetingRef,
      {
        status: "ended",
        endedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true, err: null };
  } catch (error) {
    console.error("Error ending meeting:", error);
    return { success: false, err: error.message };
  }
};

// Generate a random meeting ID (alternative to using Firestore auto-generated IDs)
export const generateMeetingId = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
