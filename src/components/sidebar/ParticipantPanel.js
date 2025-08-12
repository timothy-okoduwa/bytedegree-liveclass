import { useMeeting, useParticipant } from "../../FirebaseMeetingProvider"; // FIXED: Import from your Firebase provider
import React, { useMemo } from "react";
import MicOffIcon from "../../icons/ParticipantTabPanel/MicOffIcon";
import MicOnIcon from "../../icons/ParticipantTabPanel/MicOnIcon";
import RaiseHand from "../../icons/ParticipantTabPanel/RaiseHand";
import VideoCamOffIcon from "../../icons/ParticipantTabPanel/VideoCamOffIcon";
import VideoCamOnIcon from "../../icons/ParticipantTabPanel/VideoCamOnIcon";
import { useMeetingAppContext } from "../../MeetingAppContextDef";
import { nameTructed } from "../../utils/helper";

function ParticipantListItem({ participantId, raisedHand }) {
  const { micOn, webcamOn, displayName, isLocal } =
    useParticipant(participantId);

  return (
    <div
      className="mt-2 m-2 p-2 bg-gray-700 rounded-lg mb-0"
      key={participantId}
    >
      <div className="flex flex-1 items-center justify-center relative">
        <div
          style={{
            color: "#212032",
            backgroundColor: "#757575",
          }}
          className="h-10 w-10 text-lg mt-0 rounded overflow-hidden flex relative items-center justify-center"
        >
          {displayName?.charAt(0).toUpperCase()}
        </div>
        <div className="ml-2 mr-1 flex flex-1">
          <p className="text-base text-white overflow-hidden whitespace-pre-wrap overflow-ellipsis">
            {isLocal ? "You" : nameTructed(displayName, 15)}
          </p>
        </div>
        {raisedHand && (
          <div className="flex items-center justify-center m-1 p-1">
            <RaiseHand fillcolor={"#fff"} />
          </div>
        )}
        <div className="m-1 p-1">{micOn ? <MicOnIcon /> : <MicOffIcon />}</div>
        <div className="m-1 p-1">
          {webcamOn ? <VideoCamOnIcon /> : <VideoCamOffIcon />}
        </div>
      </div>
    </div>
  );
}

export function ParticipantPanel({ panelHeight }) {
  const { raisedHandsParticipants } = useMeetingAppContext();
  const mMeeting = useMeeting();
  const participants = mMeeting?.participants || new Map();

  // FIXED: Proper sorting logic for Firebase participants
  const sortedRaisedHandsParticipants = useMemo(() => {
    if (!participants || participants.size === 0) return [];

    const participantIds = Array.from(participants.keys());

    // Separate participants into raised and not raised
    const notRaised = participantIds.filter(
      (pID) =>
        !raisedHandsParticipants.some(({ participantId: rPID }) => rPID === pID)
    );

    // Sort raised hands by timestamp (most recent first)
    const raisedSorted = raisedHandsParticipants
      .filter(({ participantId }) => participants.has(participantId))
      .sort((a, b) => {
        if (a.raisedHandOn > b.raisedHandOn) {
          return -1;
        }
        if (a.raisedHandOn < b.raisedHandOn) {
          return 1;
        }
        return 0;
      });

    // Combine raised hands first, then others
    const combined = [
      ...raisedSorted.map(({ participantId: p }) => ({
        raisedHand: true,
        participantId: p,
      })),
      ...notRaised.map((p) => ({ raisedHand: false, participantId: p })),
    ];

    return combined;
  }, [raisedHandsParticipants, participants]);

  // FIXED: Ensure we have participants to display
  const participantsToDisplay = useMemo(() => {
    if (sortedRaisedHandsParticipants.length > 0) {
      return sortedRaisedHandsParticipants;
    }

    // Fallback: show all participants without raised hand status
    return Array.from(participants.keys()).map((participantId) => ({
      raisedHand: false,
      participantId,
    }));
  }, [sortedRaisedHandsParticipants, participants]);

  if (!participants || participants.size === 0) {
    return (
      <div
        className="flex w-full flex-col bg-gray-750 overflow-y-auto items-center justify-center"
        style={{ height: panelHeight }}
      >
        <p className="text-white text-center">No participants yet</p>
      </div>
    );
  }

  return (
    <div
      className="flex w-full flex-col bg-gray-750 overflow-y-auto"
      style={{ height: panelHeight }}
    >
      <div
        className="flex flex-col flex-1"
        style={{ height: panelHeight - 100 }}
      >
        {participantsToDisplay.map(({ raisedHand, participantId }, index) => (
          <ParticipantListItem
            key={participantId}
            participantId={participantId}
            raisedHand={raisedHand}
          />
        ))}
      </div>
    </div>
  );
}
