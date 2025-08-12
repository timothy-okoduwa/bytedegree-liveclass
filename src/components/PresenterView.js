import { useMeeting, useParticipant } from "../FirebaseMeetingProvider"; // Updated import
import { useEffect, useMemo, useRef } from "react";
import ReactPlayer from "react-player";
import MicOffSmallIcon from "../icons/MicOffSmallIcon";
import ScreenShareIcon from "../icons/ScreenShareIcon";
import SpeakerIcon from "../icons/SpeakerIcon";
import { nameTructed } from "../utils/helper";
import { CornerDisplayName } from "./ParticipantView";

export function PresenterView({ height }) {
  const mMeeting = useMeeting();
  const presenterId = mMeeting?.presenterId;

  const videoPlayer = useRef();

  const {
    micOn,
    webcamOn,
    isLocal,
    screenShareStream,
    screenShareAudioStream,
    screenShareOn,
    displayName,
    isActiveSpeaker,
  } = useParticipant(presenterId);

  // Create media stream for screen sharing
  const mediaStream = useMemo(() => {
    if (screenShareOn && screenShareStream) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(screenShareStream.track);
      return mediaStream;
    }
    return null;
  }, [screenShareStream, screenShareOn]);

  const audioPlayer = useRef();

  // Handle screen share audio
  useEffect(() => {
    if (
      !isLocal &&
      audioPlayer.current &&
      screenShareOn &&
      screenShareAudioStream
    ) {
      const mediaStream = new MediaStream();
      mediaStream.addTrack(screenShareAudioStream.track);

      audioPlayer.current.srcObject = mediaStream;
      audioPlayer.current.play().catch((err) => {
        if (
          err.message ===
          "play() failed because the user didn't interact with the document first. https://goo.gl/xX8pDD"
        ) {
          console.error("audio" + err.message);
        }
      });
    } else {
      if (audioPlayer.current) {
        audioPlayer.current.srcObject = null;
      }
    }
  }, [screenShareAudioStream, screenShareOn, isLocal]);

  const handleStopPresenting = () => {
    if (mMeeting && mMeeting.toggleScreenShare) {
      mMeeting.toggleScreenShare();
    } else {
      console.error("toggleScreenShare function not available");
    }
  };

  return (
    <div
      className={`bg-gray-750 rounded m-2 relative overflow-hidden w-full h-[${
        height - "xl:p-6 lg:p-[52px] md:p-[26px] p-1"
      }]`}
    >
      <audio autoPlay playsInline controls={false} ref={audioPlayer} />
      <div className={"video-contain absolute h-full w-full"}>
        {mediaStream ? (
          <ReactPlayer
            ref={videoPlayer}
            playsinline // very very imp prop
            playIcon={<></>}
            pip={false}
            light={false}
            controls={false}
            muted={true}
            playing={true}
            url={mediaStream}
            height={"100%"}
            width={"100%"}
            style={{
              // REMOVED: filter blur for local participant to see their own screen
              // You can now see what you're sharing!
              filter: undefined,
            }}
            onError={(err) => {
              console.log(err, "presenter video error");
            }}
          />
        ) : (
          // Fallback when no screen stream is available
          <div className="flex items-center justify-center h-full w-full bg-gray-800">
            <div className="text-center">
              <ScreenShareIcon
                style={{
                  height: 48,
                  width: 48,
                  color: "white",
                  margin: "0 auto",
                }}
              />
              <p className="text-white mt-4">No screen share active</p>
            </div>
          </div>
        )}

        {/* Bottom status bar */}
        <div
          className="bottom-2 left-2 bg-gray-750 p-2 absolute rounded-md flex items-center justify-center"
          style={{
            transition: "all 200ms",
            transitionTimingFunction: "linear",
          }}
        >
          {!micOn ? (
            <MicOffSmallIcon fillcolor="white" />
          ) : micOn && isActiveSpeaker ? (
            <SpeakerIcon />
          ) : (
            <></>
          )}

          <p className="text-sm text-white">
            {isLocal
              ? `You are presenting`
              : `${nameTructed(displayName, 15)} is presenting`}
          </p>
        </div>

        {/* Local presenter overlay - only show for local participant */}
        {isLocal && screenShareOn && (
          <>
            {/* Optional: You can show a small overlay indicating you're presenting */}
            <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-md text-sm">
              You are presenting
            </div>

            {/* Stop presenting button */}
            <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2">
              <button
                className="bg-red-550 hover:bg-red-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                onClick={handleStopPresenting}
              >
                STOP PRESENTING
              </button>
            </div>

            <CornerDisplayName
              {...{
                isLocal,
                displayName,
                micOn,
                webcamOn,
                isPresenting: true,
                participantId: presenterId,
                isActiveSpeaker,
              }}
            />
          </>
        )}

        {/* Fallback overlay when local but no screen share (shouldn't happen) */}
        {isLocal && !screenShareOn && (
          <div className="p-10 rounded-2xl flex flex-col items-center justify-center absolute top-1/2 left-1/2 bg-gray-750 transform -translate-x-1/2 -translate-y-1/2">
            <ScreenShareIcon
              style={{ height: 48, width: 48, color: "white" }}
            />
            <div className="mt-4">
              <p className="text-white text-xl font-semibold">
                Screen sharing stopped
              </p>
            </div>
            <div className="mt-8">
              <button
                className="bg-blue-550 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm text-center font-medium transition-colors"
                onClick={handleStopPresenting}
              >
                START PRESENTING
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
