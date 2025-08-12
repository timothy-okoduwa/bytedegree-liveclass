import React, { useMemo } from "react";
// Updated import - use Firebase provider instead of VideoSDK
import { useMeeting } from "../../FirebaseMeetingProvider";
import { MemoizedParticipantGrid } from "../../components/ParticipantGrid";

function ParticipantsViewer({ isPresenting }) {
  const {
    participants,
    // Note: pinnedParticipants is VideoSDK specific - we'll implement basic version
    // pinnedParticipants,
    activeSpeakerId,
    localParticipant,
    localScreenShareOn,
    presenterId,
  } = useMeeting();

  const participantIds = useMemo(() => {
    // For Firebase implementation, we'll simplify the logic since pinnedParticipants
    // is a VideoSDK-specific feature. You can implement pinning later if needed.

    if (!participants || !localParticipant) {
      return [];
    }

    // Get all participant IDs except local participant
    const regularParticipantIds = [...participants.keys()].filter(
      (participantId) => participantId !== localParticipant.id
    );

    // Start with local participant, then add others
    const ids = [localParticipant.id, ...regularParticipantIds].slice(
      0,
      isPresenting ? 6 : 16
    );

    // If there's an active speaker and it's not already in the list, replace the last one
    if (activeSpeakerId && ids.length > 1) {
      if (!ids.includes(activeSpeakerId)) {
        ids[ids.length - 1] = activeSpeakerId;
      }
    }

    return ids;
  }, [
    participants,
    activeSpeakerId,
    // Remove pinnedParticipants dependency for now
    // pinnedParticipants,
    presenterId,
    localScreenShareOn,
    localParticipant,
  ]);

  // Add safety check to prevent rendering before meeting is initialized
  if (!participants || !localParticipant) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white">Loading participants...</div>
      </div>
    );
  }

  return (
    <MemoizedParticipantGrid
      participantIds={participantIds}
      isPresenting={isPresenting}
    />
  );
}

const MemorizedParticipantView = React.memo(
  ParticipantsViewer,
  (prevProps, nextProps) => {
    return prevProps.isPresenting === nextProps.isPresenting;
  }
);

export default MemorizedParticipantView;
