import { useState, useEffect, useRef } from 'react';
import { Peer } from 'peerjs';
import './App.css';
import go from './assets/go.mp3';

function App() {
  const [role, setRole] = useState(null); // 'start' or 'finish'
  const [connectionId, setConnectionId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Not connected');
  const [raceStarted, setRaceStarted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [videoURL, setVideoURL] = useState(null);
  
  const peerRef = useRef(null);
  const connectionRef = useRef(null);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const audioRef = useRef(new Audio(go));
  
  useEffect(() => {
    
    return () => {
      // Cleanup on unmount
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);


  const initializePeer = () => {
    // Initialize PeerJS
    const peer = new Peer();
    
    peer.on('open', (id) => {
      setConnectionId(id);
      console.log('My peer ID is: ' + id);
    });
    
    peer.on('connection', (conn) => {
      handleConnection(conn);
    });
    
    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      setConnectionStatus('Connection error: ' + err.type);
    });
    
    peerRef.current = peer;
  };

  const connectToPeer = () => {
    if (!targetId) {
      alert('Please enter the other device\'s ID');
      return;
    }
    
    setConnectionStatus('Connecting...');
    const conn = peerRef.current.connect(targetId);
    handleConnection(conn);
  };

  const handleConnection = (conn) => {
    connectionRef.current = conn;
    
    conn.on('open', () => {
      console.log('Connected here');
      setConnectionStatus('Connected!');
      
      conn.on('data', (data) => {
        handleDataReceived(data);
      });
    });
    
    conn.on('close', () => {
      setConnectionStatus('Connection closed');
    });
    
    conn.on('error', (err) => {
      console.error('Connection error:', err);
      setConnectionStatus('Connection error');
    });
  };

  const handleDataReceived = (data) => {
    console.log('Received data:', data);
    
    if (data.type === 'ready') {
      // Handle 'ready' signal
      console.log('Ready signal received');
    } else if (data.type === 'start') {
      // Handle 'start' signal
      console.log('Start signal received');
      if (role === 'finish') {
        startRecording();
      }
    } else if (data.type === 'stop') {
      // Handle 'stop' signal
      console.log('Stop signal received');
      if (role === 'finish') {
        stopRecording();
      }
    }
  };

  const sendData = (data) => {
    if (connectionRef.current && connectionRef.current.open) {
      connectionRef.current.send(data);
    } else {
      console.warn('Cannot send data: No open connection');
      setConnectionStatus('Not connected. Reconnect required.');
    }
  };

  const selectRole = (selectedRole) => {
    setRole(selectedRole);
    initializePeer();
  };

  const [streamReady, setStreamReady] = useState(false);

  const setupCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: true 
      });
      streamRef.current = stream;
      setStreamReady(true); // Wait for component to render <video> first
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  // Attach stream when both videoRef and stream are ready
  useEffect(() => {
    if (streamReady && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [streamReady]);

  useEffect(() => {
    if (role === 'finish' && connectionStatus === 'Connected!') {
      setupCamera();
    }
  }, [role, connectionStatus]);

  const startRace = async () => {
    setIsReady(true);
    audioRef.current.play().catch(err => {
      console.error('Test sound playback failed:', err);
      alert('Audio playback failed. Try tapping the screen first to enable audio on iOS.');
    });
    
    try {
      setTimeout(() => {
        setIsReady(false);
        
        // Start the race
        setRaceStarted(true);
        startTimeRef.current = Date.now();
        
        // Start the timer
        timerIntervalRef.current = setInterval(() => {
          const elapsed = Date.now() - startTimeRef.current;
          setElapsedTime(elapsed);
        }, 10);
        
        // Send start signal to finish line device
        sendData({ type: 'start' });
      }, 12700); // Adjust timing based on the length of your "Ready" audio=
    } catch (error) {
      console.error('Error playing ready sound:', error);
      alert('Audio playback failed. Please check your device settings.');
    }
  };

  const startRecording = () => {
    if (!streamRef.current) {
      console.error('No media stream available');
      return;
    }
    
    try {
      setIsRecording(true);
      setRecordedChunks([]);
      
      // Try WebM first, fall back to MP4 for iOS
      let options;
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        options = { mimeType: 'video/webm;codecs=vp9,opus' };
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options = { mimeType: 'video/webm' };
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        options = { mimeType: 'video/mp4' };
      } else {
        // Let browser choose format
        options = {};
      }
      
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };
      
      // Request data every second instead of just at the end
      mediaRecorderRef.current.start(1000);
    } catch (err) {
      console.error('Error starting recording:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop the timer if we're the start device
      if (role === 'start' && timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      
      // Process and save recording on next tick
      setTimeout(() => {
        processRecording();
      }, 100);
    }
  };
  
  const processRecording = () => {
    if (recordedChunks.length === 0) {
      console.warn('No recorded data available');
      return;
    }
    
    try {
      // Determine the MIME type
      let mimeType = 'video/webm';
      if (recordedChunks[0].type) {
        mimeType = recordedChunks[0].type;
      }
      
      // Create a blob from the recorded chunks
      const blob = new Blob(recordedChunks, { type: mimeType });
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      setVideoURL(url);
      
      // For iOS, we need to create a download link
      console.log('Video recording size:', Math.round(blob.size / 1024 / 1024 * 100) / 100, 'MB');
    } catch (err) {
      console.error('Error processing recording:', err);
    }
  };
  
  const downloadVideo = () => {
    if (!videoURL) return;
    
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = videoURL;
    a.download = `race-recording-${new Date().toISOString()}.webm`;
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
  };

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  const playSound = () => {
    console.log(audioRef.current)
    audioRef.current.play().catch(err => {
      console.error('Test sound playback failed:', err);
      alert('Audio playback failed. Try tapping the screen first to enable audio on iOS.');
    });
  };

  return (
    <div className="app">
      <div className="container">
        {/* Role Selection Screen */}
        {!role && (
          <div className="screen role-screen">
            <div className="role-selector">
              <h1>Race Timer App</h1>
              <button onClick={playSound}>Test Sound</button>
              <p>Select your role</p>
              <button 
                className="role-btn"
                onClick={() => selectRole('start')}
              >
                START LINE
              </button>
              <button 
                className="role-btn"
                onClick={() => selectRole('finish')}
              >
                FINISH LINE
              </button>
            </div>
          </div>
        )}

        {/* Connection Screen - shown after role selection */}
        {role && connectionStatus !== 'Connected!' && (
          <div className="screen connection-screen">
            <h2>Connect Devices</h2>
            <div className="connection-id">
              <p>Your connection ID:</p>
              <div className="id-display">{connectionId || 'Generating...'}</div>
              <p className="status-text">Share this ID with the other device</p>
            </div>
            
            <div className="connect-form">
              <p>Enter other device's ID:</p>
              <input
                type="text"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="Paste connection ID here"
              />
              <button 
                className="connect-btn"
                onClick={connectToPeer}
              >
                Connect
              </button>
            </div>
            
            <p className="status-text">{connectionStatus}</p>
          </div>
        )}

        {/* Start Line Screen */}
        {role === 'start' && connectionStatus === 'Connected!' && (
          <div className="screen start-screen">
            <h2>START LINE</h2>
            {isReady && <div className="ready-text">READY</div>}
            <button 
              className="action-btn"
              onClick={startRace}
              disabled={raceStarted}
            >
              {raceStarted ? 'RACE STARTED' : 'START RACE'}
            </button>
            <p className="status-text">
              Press to announce "Ready" then beep
            </p>
            <div className="timer">
              {formatTime(elapsedTime)}
            </div>
          </div>
        )}

        {/* Finish Line Screen */}
        {role === 'finish' && connectionStatus === 'Connected!' && (
          <div className="screen finish-screen">
            <h2>FINISH LINE</h2>
            <div className="video-container">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="video-feed"
              />
            </div>
            <div className="recording-status">
              {isRecording ? (
                <div className="recording">
                  <div className="recording-indicator"></div>
                  <p>Recording...</p>
                </div>
              ) : (
                <p>Waiting for race to start...</p>
              )}
            </div>
            {isRecording && (
              <button 
                className="action-btn stop-btn"
                onClick={stopRecording}
              >
                STOP RECORDING
              </button>
            )}
            
            {/* Video playback and download section */}
            {videoURL && (
              <div className="video-result">
                <h3>Race Recording</h3>
                <video 
                  controls 
                  src={videoURL} 
                  className="recorded-video"
                  style={{ width: '100%', maxHeight: '200px' }}
                />
                <button 
                  className="download-btn"
                  onClick={downloadVideo}
                >
                  Download Recording
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;