import { useMemo } from "react";
// Update this import path to point to your Firebase provider
import { Constants, useMeeting } from "../FirebaseMeetingProvider";

const useIsRecording = () => {
  const { recordingState } = useMeeting();

  const isRecording = useMemo(
    () =>
      recordingState === Constants.recordingEvents.RECORDING_STARTED ||
      recordingState === Constants.recordingEvents.RECORDING_STOPPING,
    [recordingState]
  );

  return isRecording;
};

export default useIsRecording;
