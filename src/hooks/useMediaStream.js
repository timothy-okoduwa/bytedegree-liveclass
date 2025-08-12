const useMediaStream = () => {
  const getVideoTrack = async ({ webcamId, encoderConfig }) => {
    try {
      // Create video constraints
      const constraints = {
        video: {
          deviceId: webcamId ? { exact: webcamId } : undefined,
          // Map VideoSDK encoder configs to standard constraints
          width: getVideoWidth(encoderConfig),
          height: getVideoHeight(encoderConfig),
          frameRate: { ideal: 30, max: 30 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = stream.getVideoTracks()[0];

      // Stop the stream since we only need the track
      stream.getAudioTracks().forEach((track) => track.stop());

      return videoTrack;
    } catch (error) {
      console.error("Error getting video track:", error);
      return null;
    }
  };

  const getAudioTrack = async ({ micId }) => {
    try {
      const constraints = {
        audio: {
          deviceId: micId ? { exact: micId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTrack = stream.getAudioTracks()[0];

      // Stop video tracks if any
      stream.getVideoTracks().forEach((track) => track.stop());

      return audioTrack;
    } catch (error) {
      console.error("Error getting audio track:", error);
      return null;
    }
  };

  // Helper function to map VideoSDK encoder configs to video dimensions
  const getVideoWidth = (encoderConfig) => {
    switch (encoderConfig) {
      case "h90p_w160p":
        return 160;
      case "h180p_w320p":
        return 320;
      case "h216p_w384p":
        return 384;
      case "h360p_w640p":
        return 640;
      case "h540p_w960p":
        return 960;
      case "h720p_w1280p":
        return 1280;
      case "h1080p_w1920p":
        return 1920;
      default:
        return 960; // Default to h540p_w960p
    }
  };

  const getVideoHeight = (encoderConfig) => {
    switch (encoderConfig) {
      case "h90p_w160p":
        return 90;
      case "h180p_w320p":
        return 180;
      case "h216p_w384p":
        return 216;
      case "h360p_w640p":
        return 360;
      case "h540p_w960p":
        return 540;
      case "h720p_w1280p":
        return 720;
      case "h1080p_w1920p":
        return 1080;
      default:
        return 540; // Default to h540p_w960p
    }
  };

  // Additional utility functions that might be useful
  const createVideoStream = async ({ webcamId, encoderConfig }) => {
    try {
      const constraints = {
        video: {
          deviceId: webcamId ? { exact: webcamId } : undefined,
          width: getVideoWidth(encoderConfig),
          height: getVideoHeight(encoderConfig),
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      };

      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      console.error("Error creating video stream:", error);
      return null;
    }
  };

  const createAudioStream = async ({ micId }) => {
    try {
      const constraints = {
        video: false,
        audio: {
          deviceId: micId ? { exact: micId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      console.error("Error creating audio stream:", error);
      return null;
    }
  };

  const createScreenShareStream = async () => {
    try {
      return await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "monitor",
        },
        audio: true,
      });
    } catch (error) {
      console.error("Error creating screen share stream:", error);
      return null;
    }
  };

  return {
    getVideoTrack,
    getAudioTrack,
    createVideoStream,
    createAudioStream,
    createScreenShareStream,
  };
};

export default useMediaStream;
