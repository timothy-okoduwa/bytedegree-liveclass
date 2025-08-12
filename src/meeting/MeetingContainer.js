import React, { useState, useEffect, useRef, createRef, memo } from "react";
// Updated import - use Firebase provider instead of VideoSDK
import {
  Constants,
  useMeeting,
  useParticipant,
  usePubSub,
} from "../FirebaseMeetingProvider";
import { BottomBar } from "./components/BottomBar";
import { SidebarConatiner } from "../components/sidebar/SidebarContainer";
import MemorizedParticipantView from "./components/ParticipantView";
import { PresenterView } from "../components/PresenterView";
import { nameTructed, trimSnackBarText } from "../utils/helper";
import WaitingToJoinScreen from "../components/screens/WaitingToJoinScreen";
import ConfirmBox from "../components/ConfirmBox";
import useIsMobile from "../hooks/useIsMobile";
import useIsTab from "../hooks/useIsTab";
import { useMediaQuery } from "react-responsive";
import { toast } from "react-toastify";
import { useMeetingAppContext } from "../MeetingAppContextDef";
import RaiseHandIcon from "../icons/Bottombar/RaiseHandIcon";

export function MeetingContainer({ onMeetingLeave, setIsMeetingLeft }) {
  const { setSelectedMic, setSelectedWebcam, setSelectedSpeaker } =
    useMeetingAppContext();

  const [participantsData, setParticipantsData] = useState([]);

  // Raised hand state management
  const [raisedHands, setRaisedHands] = useState(new Map());
  const [showRaisedHandNotification, setShowRaisedHandNotification] =
    useState(false);
  const [currentRaisedHand, setCurrentRaisedHand] = useState(null);

  // Combined component to handle both audio and video streams
  const ParticipantStreamHandler = memo(
    ({ participantId }) => {
      const { micStream, webcamStream } = useParticipant(participantId);

      useEffect(() => {
        // Handle audio stream
        if (micStream) {
          const mediaStream = new MediaStream();
          mediaStream.addTrack(micStream.track);

          const audioElement = new Audio();
          audioElement.srcObject = mediaStream;
          audioElement.play().catch(console.error);
        }
      }, [micStream]);

      // Return null since this is just for stream handling
      // The actual video rendering happens in ParticipantView
      return null;
    },
    [participantsData]
  );

  // Raised Hand Modal Component
  const HandRaisedModal = ({ participant, onDismiss, onLowerHand }) => {
    if (!participant) return null;

    return (
      <div className="absolute top-4 right-4 z-50 bg-blue-600 text-white p-4 rounded-lg shadow-lg max-w-sm animate-bounce">
        <div className="flex items-center space-x-3">
          <RaiseHandIcon className="w-6 h-6 text-yellow-300" />
          <div className="flex-1">
            <p className="font-semibold">
              {participant.senderName} raised their hand
            </p>
            <p className="text-sm opacity-90">Click to dismiss</p>
          </div>
          <button
            onClick={onDismiss}
            className="text-white hover:text-gray-200 text-xl leading-none"
          >
            ×
          </button>
        </div>
        {participant.isOwn && (
          <button
            onClick={onLowerHand}
            className="mt-2 w-full bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-sm transition-colors"
          >
            Lower My Hand
          </button>
        )}
      </div>
    );
  };

  // Raised Hands List Component
  const RaisedHandsList = ({ raisedHands }) => {
    if (raisedHands.size === 0) return null;

    return (
      <div className="absolute top-4 left-4 z-40 bg-gray-900 bg-opacity-90 text-white p-3 rounded-lg shadow-lg max-w-xs">
        <div className="flex items-center space-x-2 mb-2">
          <RaiseHandIcon className="w-5 h-5 text-yellow-300" />
          {/* <h3 className="font-semibold text-sm">
            Raised Hands ({raisedHands.size})
          </h3> */}
        </div>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {Array.from(raisedHands.values()).map((participant, index) => (
            <div
              key={participant.senderId}
              className="flex items-center justify-between text-sm py-1"
            >
              <span className="text-gray-200">
                {participant.senderName} Rasised hand 🖐️
              </span>
              <span className="text-xs text-dark-400">
                {new Date(participant.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const { useRaisedHandParticipants } = useMeetingAppContext();
  const bottomBarHeight = 60;

  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [localParticipantAllowedJoin, setLocalParticipantAllowedJoin] =
    useState(null);
  const [meetingErrorVisible, setMeetingErrorVisible] = useState(false);
  const [meetingError, setMeetingError] = useState(false);

  const mMeetingRef = useRef();
  const containerRef = createRef();
  const containerHeightRef = useRef();
  const containerWidthRef = useRef();
  const notificationTimeoutRef = useRef(null);

  useEffect(() => {
    containerHeightRef.current = containerHeight;
    containerWidthRef.current = containerWidth;
  }, [containerHeight, containerWidth]);

  const isMobile = useIsMobile();
  const isTab = useIsTab();
  const isLGDesktop = useMediaQuery({ minWidth: 1024, maxWidth: 1439 });
  const isXLDesktop = useMediaQuery({ minWidth: 1440 });

  const sideBarContainerWidth = isXLDesktop
    ? 400
    : isLGDesktop
    ? 360
    : isTab
    ? 320
    : isMobile
    ? 280
    : 240;

  useEffect(() => {
    containerRef.current?.offsetHeight &&
      setContainerHeight(containerRef.current.offsetHeight);
    containerRef.current?.offsetWidth &&
      setContainerWidth(containerRef.current.offsetWidth);

    const handleResize = () => {
      containerRef.current?.offsetHeight &&
        setContainerHeight(containerRef.current.offsetHeight);
      containerRef.current?.offsetWidth &&
        setContainerWidth(containerRef.current.offsetWidth);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [containerRef]);

  const { participantRaisedHand } = useRaisedHandParticipants();

  const _handleMeetingLeft = () => {
    setIsMeetingLeft(true);
  };

  const _handleOnRecordingStateChanged = ({ status }) => {
    if (
      status === Constants.recordingEvents.RECORDING_STARTED ||
      status === Constants.recordingEvents.RECORDING_STOPPED
    ) {
      toast(
        `${
          status === Constants.recordingEvents.RECORDING_STARTED
            ? "Meeting recording is started"
            : "Meeting recording is stopped."
        }`,
        {
          position: "bottom-left",
          autoClose: 4000,
          hideProgressBar: true,
          closeButton: false,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "light",
        }
      );
    }
  };

  function onParticipantJoined(participant) {
    console.log("Participant joined:", participant);
    // Note: setQuality is VideoSDK specific, so we'll remove it
    // In Firebase implementation, quality is handled by WebRTC automatically
  }

  function onEntryResponded(participantId, name) {
    // This is VideoSDK specific for waiting room functionality
    // For Firebase, we'll assume all participants are allowed to join
    if (mMeetingRef.current?.localParticipant?.id === participantId) {
      if (name === "allowed") {
        setLocalParticipantAllowedJoin(true);
      } else {
        setLocalParticipantAllowedJoin(false);
        setTimeout(() => {
          _handleMeetingLeft();
        }, 3000);
      }
    }
  }

  function onMeetingJoined() {
    console.log("onMeetingJoined");
    // For Firebase, we'll automatically allow join since there's no waiting room by default
    setLocalParticipantAllowedJoin(true);
  }

  function onMeetingLeft() {
    setSelectedMic({ id: null, label: null });
    setSelectedWebcam({ id: null, label: null });
    setSelectedSpeaker({ id: null, label: null });
    onMeetingLeave();
  }

  const _handleOnError = (data) => {
    const { code, message } = data;
    console.log("meetingErr", code, message);

    const joiningErrCodes = [
      4001, 4002, 4003, 4004, 4005, 4006, 4007, 4008, 4009, 4010,
    ];

    const isJoiningError = joiningErrCodes.findIndex((c) => c === code) !== -1;
    const isCriticalError = `${code}`.startsWith("500");

    new Audio(
      isCriticalError
        ? `https://static.videosdk.live/prebuilt/notification_critical_err.mp3`
        : `https://static.videosdk.live/prebuilt/notification_err.mp3`
    ).play();

    setMeetingErrorVisible(true);
    setMeetingError({
      code,
      message: isJoiningError ? "Unable to join meeting!" : message,
    });
  };

  const mMeeting = useMeeting({
    onParticipantJoined,
    onEntryResponded,
    onMeetingJoined,
    onMeetingLeft,
    onError: _handleOnError,
    onRecordingStateChanged: _handleOnRecordingStateChanged,
  });

  const isPresenting = mMeeting.presenterId ? true : false;

  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      const participantIds = Array.from(mMeeting.participants.keys());
      console.log("Debounced participantIds", participantIds);
      console.log("Full participants map:", mMeeting.participants);

      setParticipantsData(participantIds);
      console.log("Setting participants");
    }, 500);

    return () => clearTimeout(debounceTimeout);
  }, [mMeeting.participants]);

  useEffect(() => {
    mMeetingRef.current = mMeeting;
  }, [mMeeting]);

  // Handle raised hand notifications in meeting container
  const handleRaisedHandNotification = (participant, isOwn) => {
    // Clear any existing notification timeout
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    setCurrentRaisedHand({
      ...participant,
      isOwn,
    });
    setShowRaisedHandNotification(true);

    // Auto-dismiss notification after 8 seconds
    notificationTimeoutRef.current = setTimeout(() => {
      setShowRaisedHandNotification(false);
      setCurrentRaisedHand(null);
    }, 8000);
  };

  const handleDismissNotification = () => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    setShowRaisedHandNotification(false);
    setCurrentRaisedHand(null);
  };

  const handleLowerHandFromNotification = () => {
    // This would trigger the lower hand action in the bottom bar
    // You might want to expose this function from BottomBar or create a shared context
    handleDismissNotification();
  };

  // PubSub for raise hand functionality in meeting container
  usePubSub("RAISE_HAND", {
    onMessageReceived: (data) => {
      console.log("Raise hand message received in meeting container:", data);
      const localParticipantId = mMeeting?.localParticipant?.id;
      const { senderId, senderName, message } = data;
      const isOwn = senderId === localParticipantId;

      if (message === "Raise Hand") {
        const participantData = {
          senderId,
          senderName,
          timestamp: Date.now(),
        };

        // Add to raised hands list
        setRaisedHands((prev) => {
          const newMap = new Map(prev);
          newMap.set(senderId, participantData);
          return newMap;
        });

        // Show notification (only for others' hands, not your own)
        if (!isOwn) {
          handleRaisedHandNotification(participantData, false);
        }
      } else if (message === "Lower Hand") {
        // Remove from raised hands list
        setRaisedHands((prev) => {
          const newMap = new Map(prev);
          newMap.delete(senderId);
          return newMap;
        });

        // If this was the currently shown notification, dismiss it
        if (currentRaisedHand && currentRaisedHand.senderId === senderId) {
          handleDismissNotification();
        }
      }
    },
  });

  // PubSub for chat functionality
  usePubSub("CHAT", {
    onMessageReceived: (data) => {
      const localParticipantId = mMeeting?.localParticipant?.id;
      const { senderId, senderName, message } = data;
      const isLocal = senderId === localParticipantId;

      if (!isLocal) {
        new Audio(
          `https://static.videosdk.live/prebuilt/notification.mp3`
        ).play();

        toast(
          `${trimSnackBarText(
            `${nameTructed(senderName, 15)} says: ${message}`
          )}`,
          {
            position: "bottom-left",
            autoClose: 4000,
            hideProgressBar: true,
            closeButton: false,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "light",
          }
        );
      }
    },
  });

  // Cleanup notification timeout on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0">
      <div ref={containerRef} className="h-full flex flex-col bg-gray-800">
        {typeof localParticipantAllowedJoin === "boolean" ? (
          localParticipantAllowedJoin ? (
            <>
              <div className={`flex flex-1 flex-row bg-gray-800 relative`}>
                {/* Raised Hand Notification */}
                {showRaisedHandNotification && (
                  <HandRaisedModal
                    participant={currentRaisedHand}
                    onDismiss={handleDismissNotification}
                    onLowerHand={handleLowerHandFromNotification}
                  />
                )}

                {/* Raised Hands List */}
                <RaisedHandsList raisedHands={raisedHands} />

                <div className={`flex flex-1`}>
                  {isPresenting ? (
                    <PresenterView height={containerHeight - bottomBarHeight} />
                  ) : null}

                  {/* Always render the main participant view */}
                  <MemorizedParticipantView
                    isPresenting={isPresenting}
                    participantsData={participantsData}
                  />

                  {/* Handle audio streams for all participants */}
                  {participantsData.map((participantId) => (
                    <ParticipantStreamHandler
                      key={`stream-${participantId}`}
                      participantId={participantId}
                    />
                  ))}
                </div>

                <SidebarConatiner
                  height={containerHeight - bottomBarHeight}
                  sideBarContainerWidth={sideBarContainerWidth}
                />
              </div>

              <BottomBar
                bottomBarHeight={bottomBarHeight}
                setIsMeetingLeft={setIsMeetingLeft}
              />
            </>
          ) : (
            <></>
          )
        ) : (
          !mMeeting.isMeetingJoined && <WaitingToJoinScreen />
        )}
        <ConfirmBox
          open={meetingErrorVisible}
          successText="OKAY"
          onSuccess={() => {
            setMeetingErrorVisible(false);
          }}
          title={`Error Code: ${meetingError.code}`}
          subTitle={meetingError.message}
        />
      </div>
    </div>
  );
}
