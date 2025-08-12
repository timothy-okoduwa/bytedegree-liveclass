// FirebaseMeetingProvider.js - Fixed with Screen Share
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  addDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase-config"; // You'll need to create this

const FirebaseMeetingContext = createContext();

// Mock Constants object to replace VideoSDK constants
export const Constants = {
  recordingEvents: {
    RECORDING_STARTED: "RECORDING_STARTED",
    RECORDING_STOPPED: "RECORDING_STOPPED",
    RECORDING_STARTING: "RECORDING_STARTING",
    RECORDING_STOPPING: "RECORDING_STOPPING",
  },
  permission: {
    AUDIO: "microphone",
    VIDEO: "camera",
  },
};

export const FirebaseMeetingProvider = ({
  config,
  children,
  onMeetingLeft,
  reinitialiseMeetingOnConfigChange,
  joinWithoutUserInteraction,
}) => {
  const {
    meetingId,
    micEnabled,
    webcamEnabled,
    name,
    multiStream,
    customCameraVideoTrack,
    customMicrophoneAudioTrack,
  } = config;

  const [participants, setParticipants] = useState(new Map());
  const [localParticipant, setLocalParticipant] = useState(null);
  const [isMeetingJoined, setIsMeetingJoined] = useState(false);
  const [presenterId, setPresenterId] = useState(null);

  const peerConnections = useRef(new Map());
  const localStreams = useRef({ video: null, audio: null, screen: null });
  const participantUnsubscribes = useRef(new Map());
  const localParticipantId = useRef(null);

  // Event handlers
  const eventHandlers = useRef({});

  const generateId = () => Math.random().toString(36).substring(2, 15);

  // Initialize meeting
  useEffect(() => {
    if (meetingId && joinWithoutUserInteraction) {
      initializeMeeting();
    }

    return () => {
      cleanup();
    };
  }, [meetingId, joinWithoutUserInteraction]);

  const initializeMeeting = async () => {
    try {
      localParticipantId.current = generateId();

      // Setup local streams
      await setupLocalStreams();

      console.log("🔍 After setupLocalStreams:", {
        video: localStreams.current.video,
        audio: localStreams.current.audio,
        screen: localStreams.current.screen,
        videoTracks: localStreams.current.video?.getVideoTracks().length || 0,
        audioTracks: localStreams.current.audio?.getAudioTracks().length || 0,
        screenTracks: localStreams.current.screen?.getVideoTracks().length || 0,
      });

      // Join meeting in Firestore
      await joinMeetingInFirestore();

      // Setup meeting listeners
      setupMeetingListeners();

      setIsMeetingJoined(true);
      eventHandlers.current.onMeetingJoined?.();
    } catch (error) {
      console.error("Error initializing meeting:", error);
      eventHandlers.current.onError?.({ code: 4001, message: error.message });
    }
  };

  const setupLocalStreams = async () => {
    try {
      // Clear existing streams
      if (localStreams.current.video) {
        localStreams.current.video.getTracks().forEach((track) => track.stop());
      }
      if (localStreams.current.audio) {
        localStreams.current.audio.getTracks().forEach((track) => track.stop());
      }
      if (localStreams.current.screen) {
        localStreams.current.screen
          .getTracks()
          .forEach((track) => track.stop());
      }

      localStreams.current = { video: null, audio: null, screen: null };

      // Setup video stream
      if (customCameraVideoTrack) {
        localStreams.current.video = new MediaStream([customCameraVideoTrack]);
      } else if (webcamEnabled) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            },
            audio: false,
          });
          localStreams.current.video = videoStream;
          console.log(
            "✅ Local video stream created:",
            localStreams.current.video
          );
        } catch (error) {
          console.error("❌ Failed to get video stream:", error);
        }
      }

      // Setup audio stream
      if (customMicrophoneAudioTrack) {
        localStreams.current.audio = new MediaStream([
          customMicrophoneAudioTrack,
        ]);
      } else if (micEnabled) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          localStreams.current.audio = audioStream;
          console.log(
            "✅ Local audio stream created:",
            localStreams.current.audio
          );
        } catch (error) {
          console.error("❌ Failed to get audio stream:", error);
        }
      }

      console.log("Local streams setup complete:", {
        video: localStreams.current.video,
        audio: localStreams.current.audio,
        screen: localStreams.current.screen,
        videoTracks: localStreams.current.video?.getVideoTracks()?.length || 0,
        audioTracks: localStreams.current.audio?.getAudioTracks()?.length || 0,
        screenTracks:
          localStreams.current.screen?.getVideoTracks()?.length || 0,
      });
    } catch (error) {
      console.error("❌ Error setting up local streams:", error);
    }
  };

  const joinMeetingInFirestore = async () => {
    const participantData = {
      id: localParticipantId.current,
      displayName: name,
      joinedAt: serverTimestamp(),
      micEnabled,
      webcamEnabled,
      screenShareEnabled: false,
      isLocal: true,
      hasVideoStream: !!(localStreams.current.video && webcamEnabled),
      hasAudioStream: !!(localStreams.current.audio && micEnabled),
      hasScreenStream: false,
    };

    console.log("Joining meeting with participant data:", participantData);

    // Add participant to meeting
    await setDoc(
      doc(
        db,
        "meetings",
        meetingId,
        "participants",
        localParticipantId.current
      ),
      participantData
    );

    setLocalParticipant(participantData);
  };

  const setupMeetingListeners = () => {
    // Listen to participants changes
    const participantsRef = collection(
      db,
      "meetings",
      meetingId,
      "participants"
    );
    const unsubscribeParticipants = onSnapshot(participantsRef, (snapshot) => {
      const newParticipants = new Map();
      let currentPresenterId = null;

      snapshot.forEach((doc) => {
        const participantData = { id: doc.id, ...doc.data() };
        newParticipants.set(doc.id, participantData);

        // Check for presenter
        if (participantData.screenShareEnabled) {
          currentPresenterId = doc.id;
        }

        // Update local participant if it's our participant
        if (doc.id === localParticipantId.current) {
          setLocalParticipant(participantData);
        }

        // Setup WebRTC connection for new participants
        if (
          doc.id !== localParticipantId.current &&
          !peerConnections.current.has(doc.id)
        ) {
          setupPeerConnection(doc.id);
        }
      });

      setParticipants(newParticipants);
      setPresenterId(currentPresenterId);

      // Handle participant joined
      newParticipants.forEach((participant, id) => {
        if (id !== localParticipantId.current && !participants.has(id)) {
          eventHandlers.current.onParticipantJoined?.(participant);
        }
      });
    });

    participantUnsubscribes.current.set(
      "participants",
      unsubscribeParticipants
    );
  };

  const setupPeerConnection = async (remoteParticipantId) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    peerConnections.current.set(remoteParticipantId, peerConnection);

    // Add local streams
    if (localStreams.current.video) {
      localStreams.current.video.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreams.current.video);
      });
    }
    if (localStreams.current.audio) {
      localStreams.current.audio.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreams.current.audio);
      });
    }
    if (localStreams.current.screen) {
      localStreams.current.screen.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreams.current.screen);
      });
    }

    // Handle remote streams
    peerConnection.ontrack = (event) => {
      console.log("📹 Received remote stream from:", remoteParticipantId);
      // Update participant with stream
      setParticipants((prev) => {
        const updated = new Map(prev);
        const participant = updated.get(remoteParticipantId);
        if (participant) {
          participant.streams = event.streams;
          updated.set(remoteParticipantId, participant);
        }
        return updated;
      });
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        await addDoc(collection(db, "meetings", meetingId, "signaling"), {
          type: "ice-candidate",
          candidate: event.candidate.toJSON(),
          from: localParticipantId.current,
          to: remoteParticipantId,
          timestamp: serverTimestamp(),
        });
      }
    };

    // Listen for signaling messages
    const signalingRef = collection(db, "meetings", meetingId, "signaling");
    const unsubscribeSignaling = onSnapshot(signalingRef, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          if (data.to === localParticipantId.current) {
            await handleSignalingMessage(data, remoteParticipantId);
          }
        }
      });
    });

    participantUnsubscribes.current.set(
      `signaling_${remoteParticipantId}`,
      unsubscribeSignaling
    );

    // Create and send offer if we're the initiator (lower ID)
    if (localParticipantId.current < remoteParticipantId) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      await addDoc(collection(db, "meetings", meetingId, "signaling"), {
        type: "offer",
        sdp: offer.sdp,
        from: localParticipantId.current,
        to: remoteParticipantId,
        timestamp: serverTimestamp(),
      });
    }
  };

  const handleSignalingMessage = async (data, remoteParticipantId) => {
    const peerConnection = peerConnections.current.get(remoteParticipantId);
    if (!peerConnection) return;

    try {
      switch (data.type) {
        case "offer":
          await peerConnection.setRemoteDescription({
            type: "offer",
            sdp: data.sdp,
          });
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          await addDoc(collection(db, "meetings", meetingId, "signaling"), {
            type: "answer",
            sdp: answer.sdp,
            from: localParticipantId.current,
            to: remoteParticipantId,
            timestamp: serverTimestamp(),
          });
          break;

        case "answer":
          await peerConnection.setRemoteDescription({
            type: "answer",
            sdp: data.sdp,
          });
          break;

        case "ice-candidate":
          await peerConnection.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
          break;
      }
    } catch (error) {
      console.error("Error handling signaling message:", error);
    }
  };

  const leave = useCallback(async () => {
    try {
      // Remove participant from Firestore
      if (localParticipantId.current) {
        await deleteDoc(
          doc(
            db,
            "meetings",
            meetingId,
            "participants",
            localParticipantId.current
          )
        );
      }

      cleanup();
      eventHandlers.current.onMeetingLeft?.();
    } catch (error) {
      console.error("Error leaving meeting:", error);
    }
  }, [meetingId]);

  const cleanup = () => {
    // Close peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();

    // Stop local streams
    if (localStreams.current.video) {
      localStreams.current.video.getTracks().forEach((track) => track.stop());
    }
    if (localStreams.current.audio) {
      localStreams.current.audio.getTracks().forEach((track) => track.stop());
    }
    if (localStreams.current.screen) {
      localStreams.current.screen.getTracks().forEach((track) => track.stop());
    }

    // Unsubscribe from Firestore listeners
    participantUnsubscribes.current.forEach((unsub) => unsub());
    participantUnsubscribes.current.clear();

    setIsMeetingJoined(false);
    setParticipants(new Map());
    setLocalParticipant(null);
    setPresenterId(null);
  };

  const toggleMic = useCallback(async () => {
    try {
      if (!localParticipant || !meetingId || !localParticipantId.current) {
        console.error("Cannot toggle mic: missing required data");
        return;
      }

      const currentMicState = localParticipant.micEnabled;

      if (currentMicState) {
        // Turn off mic
        if (localStreams.current.audio) {
          localStreams.current.audio
            .getTracks()
            .forEach((track) => track.stop());
          localStreams.current.audio = null;
        }

        // Update Firestore
        await updateDoc(
          doc(
            db,
            "meetings",
            meetingId,
            "participants",
            localParticipantId.current
          ),
          {
            micEnabled: false,
            hasAudioStream: false,
          }
        );
      } else {
        // Turn on mic
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          localStreams.current.audio = audioStream;

          // Update Firestore
          await updateDoc(
            doc(
              db,
              "meetings",
              meetingId,
              "participants",
              localParticipantId.current
            ),
            {
              micEnabled: true,
              hasAudioStream: true,
            }
          );

          // Update WebRTC connections with new audio stream
          peerConnections.current.forEach((pc) => {
            localStreams.current.audio.getTracks().forEach((track) => {
              pc.addTrack(track, localStreams.current.audio);
            });
          });
        } catch (error) {
          console.error("Failed to enable microphone:", error);
        }
      }
    } catch (error) {
      console.error("Error toggling microphone:", error);
    }
  }, [meetingId, localParticipant]);

  const toggleWebcam = useCallback(async () => {
    try {
      if (!localParticipant || !meetingId || !localParticipantId.current) {
        console.error("Cannot toggle webcam: missing required data");
        return;
      }

      const currentWebcamState = localParticipant.webcamEnabled;

      if (currentWebcamState) {
        // Turn off webcam
        if (localStreams.current.video) {
          localStreams.current.video
            .getTracks()
            .forEach((track) => track.stop());
          localStreams.current.video = null;
        }

        // Update Firestore
        await updateDoc(
          doc(
            db,
            "meetings",
            meetingId,
            "participants",
            localParticipantId.current
          ),
          {
            webcamEnabled: false,
            hasVideoStream: false,
          }
        );
      } else {
        // Turn on webcam
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            },
            audio: false,
          });
          localStreams.current.video = videoStream;

          // Update Firestore
          await updateDoc(
            doc(
              db,
              "meetings",
              meetingId,
              "participants",
              localParticipantId.current
            ),
            {
              webcamEnabled: true,
              hasVideoStream: true,
            }
          );

          // Update WebRTC connections with new video stream
          peerConnections.current.forEach((pc) => {
            localStreams.current.video.getTracks().forEach((track) => {
              pc.addTrack(track, localStreams.current.video);
            });
          });
        } catch (error) {
          console.error("Failed to enable webcam:", error);
        }
      }
    } catch (error) {
      console.error("Error toggling webcam:", error);
    }
  }, [meetingId, localParticipant]);

  // FIXED: Screen share functionality with proper error handling and preview
  const toggleScreenShare = useCallback(async () => {
    try {
      if (!localParticipant || !meetingId || !localParticipantId.current) {
        console.error("Cannot toggle screen share: missing required data");
        return;
      }

      const currentScreenShareState = localParticipant.screenShareEnabled;

      if (currentScreenShareState) {
        // Stop screen sharing
        if (localStreams.current.screen) {
          localStreams.current.screen
            .getTracks()
            .forEach((track) => track.stop());
          localStreams.current.screen = null;
        }

        // Update Firestore
        await updateDoc(
          doc(
            db,
            "meetings",
            meetingId,
            "participants",
            localParticipantId.current
          ),
          {
            screenShareEnabled: false,
            hasScreenStream: false,
          }
        );

        console.log("✅ Screen sharing stopped");
        eventHandlers.current.onPresenterChanged?.(null);
      } else {
        // Start screen sharing
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 15 },
            },
            audio: true, // Include system audio if available
          });

          localStreams.current.screen = screenStream;

          // Handle when user stops sharing via browser controls
          screenStream.getVideoTracks()[0].addEventListener("ended", () => {
            console.log("Screen sharing ended by user");
            // Recursively call toggleScreenShare to turn it off
            toggleScreenShare();
          });

          // Update Firestore
          await updateDoc(
            doc(
              db,
              "meetings",
              meetingId,
              "participants",
              localParticipantId.current
            ),
            {
              screenShareEnabled: true,
              hasScreenStream: true,
            }
          );

          // Update WebRTC connections with new screen stream
          peerConnections.current.forEach((pc) => {
            localStreams.current.screen.getTracks().forEach((track) => {
              pc.addTrack(track, localStreams.current.screen);
            });
          });

          console.log("✅ Screen sharing started");
          eventHandlers.current.onPresenterChanged?.(
            localParticipantId.current
          );
        } catch (error) {
          console.error("Failed to start screen sharing:", error);
          if (error.name === "NotAllowedError") {
            console.log("Screen sharing permission denied");
          }
        }
      }
    } catch (error) {
      console.error("Error toggling screen share:", error);
    }
  }, [meetingId, localParticipant]);

  // FIXED: Meeting object that properly exposes toggleScreenShare
  const meeting = {
    meetingId,
    participants,
    localParticipant,
    isMeetingJoined,
    presenterId,
    join: initializeMeeting,
    leave,
    toggleMic,
    toggleWebcam,
    toggleScreenShare, // ✅ PROPERLY EXPOSED
    // Add other methods as needed
  };

  const value = {
    ...meeting,
    localStreams: localStreams.current, // ← EXPOSE LOCAL STREAMS
    // Event handler setters
    setEventHandlers: (handlers) => {
      eventHandlers.current = { ...eventHandlers.current, ...handlers };
    },
  };

  return (
    <FirebaseMeetingContext.Provider value={value}>
      {children}
    </FirebaseMeetingContext.Provider>
  );
};

// Hook to replace useMeeting from VideoSDK
export const useMeeting = (eventHandlers = {}) => {
  const context = useContext(FirebaseMeetingContext);

  useEffect(() => {
    if (context?.setEventHandlers) {
      context.setEventHandlers(eventHandlers);
    }
  }, [eventHandlers, context]);

  if (!context) {
    throw new Error("useMeeting must be used within a FirebaseMeetingProvider");
  }

  return context;
};

// FIXED: Hook to replace useParticipant from VideoSDK with proper stream handling
export const useParticipant = (participantId) => {
  const { participants, localStreams } = useContext(FirebaseMeetingContext);
  const [participant, setParticipant] = useState(null);
  const [micStream, setMicStream] = useState(null);
  const [webcamStream, setWebcamStream] = useState(null);
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [screenShareAudioStream, setScreenShareAudioStream] = useState(null);

  useEffect(() => {
    const participantData = participants.get(participantId);
    if (participantData) {
      setParticipant(participantData);

      // Handle local participant streams differently
      if (participantData.isLocal) {
        // For local participant, use the actual local streams
        if (localStreams?.video && participantData.webcamEnabled) {
          const videoTracks = localStreams.video.getVideoTracks();
          if (videoTracks.length > 0) {
            setWebcamStream({ track: videoTracks[0] });
          }
        } else {
          setWebcamStream(null);
        }

        if (localStreams?.audio && participantData.micEnabled) {
          const audioTracks = localStreams.audio.getAudioTracks();
          if (audioTracks.length > 0) {
            setMicStream({ track: audioTracks[0] });
          }
        } else {
          setMicStream(null);
        }

        // FIXED: Properly handle screen sharing streams for local participant
        if (localStreams?.screen && participantData.screenShareEnabled) {
          const screenVideoTracks = localStreams.screen.getVideoTracks();
          const screenAudioTracks = localStreams.screen.getAudioTracks();

          if (screenVideoTracks.length > 0) {
            setScreenShareStream({ track: screenVideoTracks[0] });
          }

          if (screenAudioTracks.length > 0) {
            setScreenShareAudioStream({ track: screenAudioTracks[0] });
          }
        } else {
          setScreenShareStream(null);
          setScreenShareAudioStream(null);
        }
      } else {
        // For remote participants, use streams from WebRTC
        if (participantData.streams && participantData.streams[0]) {
          const stream = participantData.streams[0];
          const audioTracks = stream.getAudioTracks();
          const videoTracks = stream.getVideoTracks();

          if (audioTracks.length > 0 && participantData.micEnabled) {
            setMicStream({ track: audioTracks[0] });
          } else {
            setMicStream(null);
          }

          if (videoTracks.length > 0) {
            // Check if this is a screen share track or webcam track
            const videoTrack = videoTracks[0];
            if (
              participantData.screenShareEnabled &&
              (videoTrack.label.includes("screen") ||
                videoTrack.label.includes("window"))
            ) {
              setScreenShareStream({ track: videoTrack });
              setWebcamStream(null);

              // Handle screen share audio if available
              if (audioTracks.length > 1) {
                setScreenShareAudioStream({ track: audioTracks[1] });
              }
            } else if (participantData.webcamEnabled) {
              setWebcamStream({ track: videoTrack });
              setScreenShareStream(null);
            }
          } else {
            setWebcamStream(null);
            setScreenShareStream(null);
          }
        } else {
          setMicStream(null);
          setWebcamStream(null);
          setScreenShareStream(null);
          setScreenShareAudioStream(null);
        }
      }
    }
  }, [participantId, participants, localStreams]);

  return {
    // Map Firebase fields to VideoSDK expected format
    displayName: participant?.displayName,
    webcamOn: participant?.webcamEnabled,
    micOn: participant?.micEnabled,
    screenShareOn: participant?.screenShareEnabled,
    isLocal: participant?.isLocal,
    participant,
    micStream,
    webcamStream,
    screenShareStream, // ✅ PROPERLY EXPOSED
    screenShareAudioStream, // ✅ PROPERLY EXPOSED
    isActiveSpeaker: false, // You can implement this logic later
    // Add other participant properties as needed
  };
};

// Hook to replace usePubSub from VideoSDK - FIXED VERSION
export const usePubSub = (topic, options = {}) => {
  const { meetingId, localParticipant } = useContext(FirebaseMeetingContext);
  const { onMessageReceived } = options;
  const [messages, setMessages] = useState([]);
  const processedMessages = useRef(new Set());
  const onMessageReceivedRef = useRef(onMessageReceived);

  // Keep the callback ref updated
  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
  }, [onMessageReceived]);

  useEffect(() => {
    if (!meetingId) return;

    const messagesRef = collection(db, "meetings", meetingId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const topicMessages = [];

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          const messageId = change.doc.id;

          // Only process messages for this topic that we haven't seen before
          if (
            data.topic === topic &&
            !processedMessages.current.has(messageId)
          ) {
            processedMessages.current.add(messageId);

            // For CHAT topic, collect messages for the messages array
            if (topic === "CHAT") {
              topicMessages.push({
                id: messageId,
                senderId: data.senderId,
                senderName: data.senderName,
                message: data.message,
                timestamp: data.timestamp,
              });
            }

            // Use the ref to get the latest callback for other topics like RAISE_HAND
            if (onMessageReceivedRef.current && topic !== "CHAT") {
              onMessageReceivedRef.current(data);
            }
          }
        }
      });

      // Update messages for CHAT topic
      if (topic === "CHAT" && topicMessages.length > 0) {
        setMessages((prev) => {
          // Get all existing messages
          const allMessages = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.topic === topic) {
              allMessages.push({
                id: doc.id,
                senderId: data.senderId,
                senderName: data.senderName,
                message: data.message,
                timestamp: data.timestamp,
              });
            }
          });
          return allMessages.sort((a, b) => {
            const aTime = a.timestamp?.seconds || a.timestamp || 0;
            const bTime = b.timestamp?.seconds || b.timestamp || 0;
            return aTime - bTime;
          });
        });
      }
    });

    return () => {
      unsubscribe();
      // DON'T clear processedMessages on cleanup - keep them to prevent duplicates
    };
  }, [meetingId, topic]); // Remove onMessageReceived from dependencies

  const publish = useCallback(
    async (message, options = {}) => {
      if (!meetingId || !localParticipant) return;

      try {
        await addDoc(collection(db, "meetings", meetingId, "messages"), {
          topic,
          message,
          senderId: options.senderId || localParticipant.id,
          senderName: options.senderName || localParticipant.displayName,
          timestamp: serverTimestamp(),
        });
      } catch (error) {
        console.error("Error publishing message:", error);
      }
    },
    [meetingId, topic, localParticipant]
  );

  return {
    publish,
    messages: topic === "CHAT" ? messages : undefined,
  };
};

// Simple media device hook to replace VideoSDK's useMediaDevice
export const useMediaDevice = ({ onDeviceChanged } = {}) => {
  const checkPermissions = async () => {
    const permissions = new Map();

    try {
      const cameraPermission = await navigator.permissions.query({
        name: "camera",
      });
      const microphonePermission = await navigator.permissions.query({
        name: "microphone",
      });

      permissions.set("camera", cameraPermission.state === "granted");
      permissions.set("microphone", microphonePermission.state === "granted");
    } catch (error) {
      // Fallback for browsers that don't support permissions API
      permissions.set("camera", false);
      permissions.set("microphone", false);
    }

    return permissions;
  };

  const requestPermission = async (mediaType) => {
    const permissions = new Map();

    try {
      let constraints = {};
      if (mediaType === "camera" || mediaType === Constants.permission.VIDEO) {
        constraints.video = true;
      }
      if (
        mediaType === "microphone" ||
        mediaType === Constants.permission.AUDIO
      ) {
        constraints.audio = true;
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach((track) => track.stop()); // Stop immediately after getting permission

      permissions.set("camera", !!constraints.video);
      permissions.set("microphone", !!constraints.audio);
    } catch (error) {
      permissions.set("camera", false);
      permissions.set("microphone", false);
    }

    return permissions;
  };

  const getCameras = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput");
  };

  const getMicrophones = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "audioinput");
  };

  const getPlaybackDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "audiooutput");
  };

  return {
    checkPermissions,
    requestPermission,
    getCameras,
    getMicrophones,
    getPlaybackDevices,
  };
};
