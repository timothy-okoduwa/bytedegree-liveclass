// App.js - Updated to use Firebase instead of VideoSDK
import { FirebaseMeetingProvider } from "./FirebaseMeetingProvider";
import { useEffect } from "react";
import { useState } from "react";
import { MeetingAppProvider } from "./MeetingAppContextDef";
import { MeetingContainer } from "./meeting/MeetingContainer";
import { LeaveScreen } from "./components/screens/LeaveScreen";
import { JoiningScreen } from "./components/screens/JoiningScreen";

function App() {
  // Remove token state since we don't need it for Firebase
  const [meetingId, setMeetingId] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [webcamOn, setWebcamOn] = useState(false);
  const [customAudioStream, setCustomAudioStream] = useState(null);
  const [customVideoStream, setCustomVideoStream] = useState(null);
  const [isMeetingStarted, setMeetingStarted] = useState(false);
  const [isMeetingLeft, setIsMeetingLeft] = useState(false);

  const isMobile = window.matchMedia(
    "only screen and (max-width: 768px)"
  ).matches;

  useEffect(() => {
    if (isMobile) {
      window.onbeforeunload = () => {
        return "Are you sure you want to exit?";
      };
    }
  }, [isMobile]);

  // Helper function to safely extract video track
  const getVideoTrack = (stream) => {
    if (!stream) return null;

    // If it's already a MediaStreamTrack, return it
    if (stream.kind === "video") {
      return stream;
    }

    // If it's a MediaStream, get the first video track
    if (stream instanceof MediaStream) {
      const videoTracks = stream.getVideoTracks();
      return videoTracks.length > 0 ? videoTracks[0] : null;
    }

    // If it has getVideoTracks method, use it
    if (typeof stream.getVideoTracks === "function") {
      const videoTracks = stream.getVideoTracks();
      return videoTracks.length > 0 ? videoTracks[0] : null;
    }

    return null;
  };

  // Helper function to safely extract audio track
  const getAudioTrack = (stream) => {
    if (!stream) return null;

    // If it's already a MediaStreamTrack, return it
    if (stream.kind === "audio") {
      return stream;
    }

    // If it's a MediaStream, get the first audio track
    if (stream instanceof MediaStream) {
      const audioTracks = stream.getAudioTracks();
      return audioTracks.length > 0 ? audioTracks[0] : null;
    }

    // If it has getAudioTracks method, use it
    if (typeof stream.getAudioTracks === "function") {
      const audioTracks = stream.getAudioTracks();
      return audioTracks.length > 0 ? audioTracks[0] : null;
    }

    return null;
  };

  return (
    <>
      <MeetingAppProvider>
        {isMeetingStarted ? (
          <FirebaseMeetingProvider
            config={{
              meetingId,
              micEnabled: micOn,
              webcamEnabled: webcamOn,
              name: participantName ? participantName : "TestUser",
              multiStream: true,
              customCameraVideoTrack: getVideoTrack(customVideoStream),
              customMicrophoneAudioTrack: getAudioTrack(customAudioStream),
            }}
            reinitialiseMeetingOnConfigChange={true}
            joinWithoutUserInteraction={true}
          >
            <MeetingContainer
              onMeetingLeave={() => {
                setMeetingId("");
                setParticipantName("");
                setWebcamOn(false);
                setMicOn(false);
                setMeetingStarted(false);
              }}
              setIsMeetingLeft={setIsMeetingLeft}
            />
          </FirebaseMeetingProvider>
        ) : isMeetingLeft ? (
          <LeaveScreen setIsMeetingLeft={setIsMeetingLeft} />
        ) : (
          <JoiningScreen
            participantName={participantName}
            setParticipantName={setParticipantName}
            setMeetingId={setMeetingId}
            // Remove setToken since we don't need it anymore
            setToken={() => {}} // Keep for compatibility but do nothing
            micOn={micOn}
            setMicOn={setMicOn}
            webcamOn={webcamOn}
            setWebcamOn={setWebcamOn}
            customAudioStream={customAudioStream}
            setCustomAudioStream={setCustomAudioStream}
            customVideoStream={customVideoStream}
            setCustomVideoStream={setCustomVideoStream}
            onClickStartMeeting={() => {
              setMeetingStarted(true);
            }}
            startMeeting={isMeetingStarted}
            setIsMeetingLeft={setIsMeetingLeft}
          />
        )}
      </MeetingAppProvider>
    </>
  );
}

export default App;

// import { MeetingProvider } from "@videosdk.live/react-sdk";
// import { useEffect } from "react";
// import { useState } from "react";
// import { MeetingAppProvider } from "./MeetingAppContextDef";
// import { MeetingContainer } from "./meeting/MeetingContainer";
// import { LeaveScreen } from "./components/screens/LeaveScreen";
// import { JoiningScreen } from "./components/screens/JoiningScreen"

// function App() {
//   const [token, setToken] = useState("");
//   const [meetingId, setMeetingId] = useState("");
//   const [participantName, setParticipantName] = useState("");
//   const [micOn, setMicOn] = useState(false);
//   const [webcamOn, setWebcamOn] = useState(false);
//   const [customAudioStream, setCustomAudioStream] = useState(null);
//   const [customVideoStream, setCustomVideoStream] = useState(null)
//   const [isMeetingStarted, setMeetingStarted] = useState(false);
//   const [isMeetingLeft, setIsMeetingLeft] = useState(false);

//   const isMobile = window.matchMedia(
//     "only screen and (max-width: 768px)"
//   ).matches;

//   useEffect(() => {
//     if (isMobile) {
//       window.onbeforeunload = () => {
//         return "Are you sure you want to exit?";
//       };
//     }
//   }, [isMobile]);

//   return (
//     <>
//       <MeetingAppProvider>
//         {isMeetingStarted ? (

//           <MeetingProvider
//             config={{
//               meetingId,
//               micEnabled: micOn,
//               webcamEnabled: webcamOn,
//               name: participantName ? participantName : "TestUser",
//               multiStream: true,
//               customCameraVideoTrack: customVideoStream,
//               customMicrophoneAudioTrack: customAudioStream
//             }}
//             token={token}
//             reinitialiseMeetingOnConfigChange={true}
//             joinWithoutUserInteraction={true}
//           >
//             <MeetingContainer
//               onMeetingLeave={() => {
//                 setToken("");
//                 setMeetingId("");
//                 setParticipantName("");
//                 setWebcamOn(false);
//                 setMicOn(false);
//                 setMeetingStarted(false);
//               }}
//               setIsMeetingLeft={setIsMeetingLeft}
//             />
//           </MeetingProvider>

//         ) : isMeetingLeft ? (
//           <LeaveScreen setIsMeetingLeft={setIsMeetingLeft} />
//         ) : (

//           <JoiningScreen
//             participantName={participantName}
//             setParticipantName={setParticipantName}
//             setMeetingId={setMeetingId}
//             setToken={setToken}
//             micOn={micOn}
//             setMicOn={setMicOn}
//             webcamOn={webcamOn}
//             setWebcamOn={setWebcamOn}
//             customAudioStream={customAudioStream}
//             setCustomAudioStream={setCustomAudioStream}
//             customVideoStream={customVideoStream}
//             setCustomVideoStream={setCustomVideoStream}
//             onClickStartMeeting={() => {
//               setMeetingStarted(true);
//             }}
//             startMeeting={isMeetingStarted}
//             setIsMeetingLeft={setIsMeetingLeft}
//           />
//         )}
//       </MeetingAppProvider>
//     </>
//   );
// }

// export default App;
