import { Popover, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useParticipant } from "../FirebaseMeetingProvider";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import ReactPlayer from "react-player";
import { useMediaQuery } from "react-responsive";
import useIsMobile from "../hooks/useIsMobile";
import useIsTab from "../hooks/useIsTab";
import useWindowSize from "../hooks/useWindowSize";
import MicOffSmallIcon from "../icons/MicOffSmallIcon";
import NetworkIcon from "../icons/NetworkIcon";
import SpeakerIcon from "../icons/SpeakerIcon";
import { getQualityScore, nameTructed } from "../utils/common";
import * as ReactDOM from "react-dom";
import { useMeetingAppContext } from "../MeetingAppContextDef";

export const CornerDisplayName = ({
  participantId,
  isPresenting,
  displayName,
  isLocal,
  micOn,
  mouseOver,
  isActiveSpeaker,
}) => {
  const isMobile = useIsMobile();
  const isTab = useIsTab();
  const isLGDesktop = useMediaQuery({ minWidth: 1024, maxWidth: 1439 });
  const isXLDesktop = useMediaQuery({ minWidth: 1440 });

  const { height: windowHeight } = useWindowSize();

  const [statsBoxHeightRef, setStatsBoxHeightRef] = useState(null);
  const [statsBoxWidthRef, setStatsBoxWidthRef] = useState(null);

  const [coords, setCoords] = useState({}); // takes current button coordinates

  const statsBoxHeight = useMemo(
    () => statsBoxHeightRef?.offsetHeight,
    [statsBoxHeightRef]
  );

  const statsBoxWidth = useMemo(
    () => statsBoxWidthRef?.offsetWidth,
    [statsBoxWidthRef]
  );

  const analyzerSize = isXLDesktop
    ? 32
    : isLGDesktop
    ? 28
    : isTab
    ? 24
    : isMobile
    ? 20
    : 18;

  const show = useMemo(() => mouseOver, [mouseOver]);

  const { webcamStream, micStream, screenShareStream } =
    useParticipant(participantId);

  const statsIntervalIdRef = useRef();
  const [score, setScore] = useState(10); // Default good score for Firebase
  const [audioStats, setAudioStats] = useState({});
  const [videoStats, setVideoStats] = useState({});

  // Simplified stats update for Firebase (WebRTC stats are more complex)
  const updateStats = async () => {
    try {
      // Using mock data for now - you can implement WebRTC stats later
      const mockStats = {
        rtt: Math.floor(Math.random() * 100) + 20,
        jitter: Math.random() * 10,
        packetsLost: Math.floor(Math.random() * 5),
        totalPackets: 1000 + Math.floor(Math.random() * 500),
        bitrate: 500 + Math.random() * 1000,
        framerate: 30,
        width: 1280,
        height: 720,
        codec: "VP8",
      };

      let qualityScore = 10;
      if (mockStats.rtt > 100) qualityScore -= 2;
      if (mockStats.jitter > 5) qualityScore -= 2;
      if (mockStats.packetsLost / mockStats.totalPackets > 0.02)
        qualityScore -= 3;

      setScore(Math.max(1, qualityScore));
      setAudioStats([mockStats]);
      setVideoStats([mockStats]);
    } catch (error) {
      console.log("Stats update error:", error);
      setScore(8);
    }
  };

  const qualityStateArray = [
    { label: "", audio: "Audio", video: "Video" },
    {
      label: "Latency",
      audio:
        audioStats && audioStats[0]?.rtt ? `${audioStats[0]?.rtt} ms` : "-",
      video:
        videoStats && videoStats[0]?.rtt ? `${videoStats[0]?.rtt} ms` : "-",
    },
    {
      label: "Jitter",
      audio:
        audioStats && audioStats[0]?.jitter
          ? `${parseFloat(audioStats[0]?.jitter).toFixed(2)} ms`
          : "-",
      video:
        videoStats && videoStats[0]?.jitter
          ? `${parseFloat(videoStats[0]?.jitter).toFixed(2)} ms`
          : "-",
    },
    {
      label: "Packet Loss",
      audio: audioStats
        ? audioStats[0]?.packetsLost
          ? `${parseFloat(
              (audioStats[0]?.packetsLost * 100) / audioStats[0]?.totalPackets
            ).toFixed(2)}%`
          : "-"
        : "-",
      video: videoStats
        ? videoStats[0]?.packetsLost
          ? `${parseFloat(
              (videoStats[0]?.packetsLost * 100) / videoStats[0]?.totalPackets
            ).toFixed(2)}%`
          : "-"
        : "-",
    },
    {
      label: "Bitrate",
      audio:
        audioStats && audioStats[0]?.bitrate
          ? `${parseFloat(audioStats[0]?.bitrate).toFixed(2)} kb/s`
          : "-",
      video:
        videoStats && videoStats[0]?.bitrate
          ? `${parseFloat(videoStats[0]?.bitrate).toFixed(2)} kb/s`
          : "-",
    },
    {
      label: "Frame rate",
      audio: "-",
      video:
        videoStats &&
        (videoStats[0]?.framerate === null ||
          videoStats[0]?.framerate === undefined)
          ? "-"
          : `${videoStats ? videoStats[0]?.framerate : "-"}`,
    },
    {
      label: "Resolution",
      audio: "-",
      video: videoStats
        ? videoStats && videoStats[0]?.width === null
          ? "-"
          : `${videoStats[0]?.width}x${videoStats[0]?.height}`
        : "-",
    },
    {
      label: "Codec",
      audio: audioStats && audioStats[0]?.codec ? audioStats[0]?.codec : "-",
      video: videoStats && videoStats[0]?.codec ? videoStats[0]?.codec : "-",
    },
    {
      label: "Cur. Layers",
      audio: "-",
      video: "-",
    },
    {
      label: "Pref. Layers",
      audio: "-",
      video: "-",
    },
  ];

  useEffect(() => {
    if (webcamStream || micStream || screenShareStream) {
      updateStats();

      if (statsIntervalIdRef.current) {
        clearInterval(statsIntervalIdRef.current);
      }

      statsIntervalIdRef.current = setInterval(updateStats, 2000);
    } else {
      if (statsIntervalIdRef.current) {
        clearInterval(statsIntervalIdRef.current);
        statsIntervalIdRef.current = null;
      }
    }

    return () => {
      if (statsIntervalIdRef.current) clearInterval(statsIntervalIdRef.current);
    };
  }, [webcamStream, micStream, screenShareStream]);

  return (
    <>
      <div
        className="absolute bottom-2 left-2 rounded-md flex items-center justify-center p-2"
        style={{
          backgroundColor: "#00000066",
          transition: "all 200ms",
          transitionTimingFunction: "linear",
          transform: `scale(${show ? 1 : 0})`,
        }}
      >
        {!micOn && !isPresenting ? (
          <MicOffSmallIcon fillcolor="white" />
        ) : micOn && isActiveSpeaker ? (
          <SpeakerIcon />
        ) : null}
        <p className="text-sm text-white ml-0.5">
          {isPresenting
            ? isLocal
              ? `You are presenting`
              : `${nameTructed(displayName, 15)} is presenting`
            : isLocal
            ? "You"
            : nameTructed(displayName, 26)}
        </p>
      </div>

      {(webcamStream || micStream || screenShareStream) && (
        <div>
          <div
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="absolute top-2 right-2 rounded-md  p-2 cursor-pointer "
          >
            <Popover className="relative ">
              {({ close }) => (
                <>
                  <Popover.Button
                    className={`absolute right-0 top-0 rounded-md flex items-center justify-center p-1.5 cursor-pointer`}
                    style={{
                      backgroundColor:
                        score > 7
                          ? "#3BA55D"
                          : score > 4
                          ? "#faa713"
                          : "#FF5D5D",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.target.getBoundingClientRect();
                      setCoords({
                        left: Math.round(rect.x + rect.width / 2),
                        top: Math.round(rect.y + window.scrollY),
                      });
                    }}
                  >
                    <div>
                      <NetworkIcon
                        color1={"#ffffff"}
                        color2={"#ffffff"}
                        color3={"#ffffff"}
                        color4={"#ffffff"}
                        style={{
                          height: analyzerSize * 0.6,
                          width: analyzerSize * 0.6,
                        }}
                      />
                    </div>
                  </Popover.Button>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-200"
                    enterFrom="opacity-0 translate-y-1"
                    enterTo="opacity-100 translate-y-0"
                    leave="transition ease-in duration-150"
                    leaveFrom="opacity-100 translate-y-0"
                    leaveTo="opacity-0 translate-y-1"
                  >
                    <Popover.Panel style={{ zIndex: 999 }} className="absolute">
                      {ReactDOM.createPortal(
                        <div
                          ref={setStatsBoxWidthRef}
                          style={{
                            top:
                              coords?.top + statsBoxHeight > windowHeight
                                ? windowHeight - statsBoxHeight - 20
                                : coords?.top,
                            left:
                              coords?.left - statsBoxWidth < 0
                                ? 12
                                : coords?.left - statsBoxWidth,
                          }}
                          className={`absolute`}
                        >
                          <div
                            ref={setStatsBoxHeightRef}
                            className="bg-gray-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 "
                          >
                            <div
                              className={`p-[9px] flex items-center justify-between rounded-t-lg`}
                              style={{
                                backgroundColor:
                                  score > 7
                                    ? "#3BA55D"
                                    : score > 4
                                    ? "#faa713"
                                    : "#FF5D5D",
                              }}
                            >
                              <p className="text-sm text-white font-semibold">{`Quality Score : ${
                                score > 7
                                  ? "Good"
                                  : score > 4
                                  ? "Average"
                                  : "Poor"
                              }`}</p>

                              <button
                                className="cursor-pointer text-white hover:bg-[#ffffff33] rounded-full px-1 text-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  close();
                                }}
                              >
                                <XMarkIcon
                                  className="text-white"
                                  style={{ height: 16, width: 16 }}
                                />
                              </button>
                            </div>
                            <div className="flex">
                              <div className="flex flex-col">
                                {qualityStateArray.map((item, index) => {
                                  return (
                                    <div
                                      key={index}
                                      className="flex"
                                      style={{
                                        borderBottom:
                                          index === qualityStateArray.length - 1
                                            ? ""
                                            : `1px solid #ffffff33`,
                                      }}
                                    >
                                      <div className="flex flex-1 items-center w-[120px]">
                                        {index !== 0 && (
                                          <p className="text-xs text-white my-[6px] ml-2">
                                            {item.label}
                                          </p>
                                        )}
                                      </div>
                                      <div
                                        className="flex flex-1 items-center justify-center"
                                        style={{
                                          borderLeft: `1px solid #ffffff33`,
                                        }}
                                      >
                                        <p className="text-xs text-white my-[6px] w-[80px] text-center">
                                          {item.audio}
                                        </p>
                                      </div>
                                      <div
                                        className="flex flex-1 items-center justify-center"
                                        style={{
                                          borderLeft: `1px solid #ffffff33`,
                                        }}
                                      >
                                        <p className="text-xs text-white my-[6px] w-[80px] text-center">
                                          {item.video}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}
                    </Popover.Panel>
                  </Transition>
                </>
              )}
            </Popover>
          </div>
        </div>
      )}
    </>
  );
};

export function ParticipantView({ participantId }) {
  const {
    displayName,
    webcamStream,
    micStream,
    webcamOn,
    micOn,
    isLocal,
    mode,
    isActiveSpeaker,
  } = useParticipant(participantId);

  const { selectedSpeaker } = useMeetingAppContext();
  const micRef = useRef(null);
  const videoRef = useRef(null);
  const [mouseOver, setMouseOver] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log(`ParticipantView ${participantId}:`, {
      displayName,
      webcamOn,
      micOn,
      hasWebcamStream: !!webcamStream,
      hasMicStream: !!micStream,
      isLocal,
      webcamStreamTrack: webcamStream?.track,
    });
  }, [
    participantId,
    displayName,
    webcamOn,
    micOn,
    webcamStream,
    micStream,
    isLocal,
  ]);

  useEffect(() => {
    const isFirefox = navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
    if (micRef.current) {
      try {
        if (!isFirefox) {
          micRef.current.setSinkId(selectedSpeaker?.id);
        }
      } catch (err) {
        console.log("Setting speaker device failed", err);
      }
    }
  }, [selectedSpeaker]);

  // Handle audio stream
  useEffect(() => {
    if (micRef.current) {
      if (micOn && micStream && micStream.track) {
        try {
          const mediaStream = new MediaStream();
          mediaStream.addTrack(micStream.track);
          micRef.current.srcObject = mediaStream;
          micRef.current
            .play()
            .catch((error) =>
              console.error("micRef.current.play() failed", error)
            );
        } catch (error) {
          console.error("Error setting up audio stream:", error);
        }
      } else {
        micRef.current.srcObject = null;
      }
    }
  }, [micStream, micOn, micRef]);

  // Handle video stream - FIXED VERSION
  useEffect(() => {
    if (videoRef.current) {
      if (webcamOn && webcamStream && webcamStream.track) {
        try {
          console.log(`Setting up video for participant ${participantId}`, {
            webcamStream,
            track: webcamStream.track,
            trackState: webcamStream.track.readyState,
            trackEnabled: webcamStream.track.enabled,
          });

          const mediaStream = new MediaStream();
          mediaStream.addTrack(webcamStream.track);

          videoRef.current.srcObject = mediaStream;
          setVideoError(false);

          // Ensure video plays
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log(
                  `Video playing successfully for participant ${participantId}`
                );
              })
              .catch((error) => {
                console.error(
                  `Failed to play video for participant ${participantId}:`,
                  error
                );
                setVideoError(true);
              });
          }
        } catch (error) {
          console.error(
            `Error setting up video stream for participant ${participantId}:`,
            error
          );
          setVideoError(true);
        }
      } else {
        console.log(
          `Clearing video for participant ${participantId}: webcamOn=${webcamOn}, hasStream=${!!webcamStream}`
        );
        videoRef.current.srcObject = null;
        setVideoError(false);
      }
    }
  }, [webcamStream, webcamOn, participantId]);

  // Check if we should show video
  const shouldShowVideo =
    webcamOn && webcamStream && webcamStream.track && !videoError;

  return (
    <div
      onMouseEnter={() => {
        setMouseOver(true);
      }}
      onMouseLeave={() => {
        setMouseOver(false);
      }}
      className={`h-full w-full bg-gray-750 relative overflow-hidden rounded-lg video-cover`}
    >
      <audio ref={micRef} autoPlay muted={isLocal} />

      {shouldShowVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          onLoadedMetadata={() => {
            console.log(
              `Video metadata loaded for participant ${participantId}`
            );
          }}
          onError={(e) => {
            console.error(
              `Video element error for participant ${participantId}:`,
              e
            );
            setVideoError(true);
          }}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center">
          <div
            className={`z-10 flex items-center justify-center rounded-full bg-gray-800 2xl:h-[92px] h-[52px] 2xl:w-[92px] w-[52px]`}
          >
            <p className="text-2xl text-white">
              {String(displayName || "U")
                .charAt(0)
                .toUpperCase()}
            </p>
          </div>

          {/* Enhanced Debug info */}
          <div className="absolute bottom-16 left-2 text-xs text-red-400 bg-black bg-opacity-50 p-1 rounded max-w-xs">
            <div>{`ID: ${participantId.slice(0, 8)}...`}</div>
            <div>{`Cam: ${webcamOn ? "ON" : "OFF"} | Stream: ${
              webcamStream ? "YES" : "NO"
            }`}</div>
            <div>{`Track: ${webcamStream?.track ? "YES" : "NO"} | Error: ${
              videoError ? "YES" : "NO"
            }`}</div>
            {webcamStream?.track && (
              <div>{`State: ${webcamStream.track.readyState} | Enabled: ${webcamStream.track.enabled}`}</div>
            )}
          </div>
        </div>
      )}

      <CornerDisplayName
        {...{
          isLocal,
          displayName,
          micOn,
          webcamOn,
          isPresenting: false,
          participantId,
          mouseOver,
          isActiveSpeaker,
        }}
      />
    </div>
  );
}
