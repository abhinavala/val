import { useState, useEffect, useRef } from 'react';
import './App.css';

const normalizeAnswer = (value) => value.trim().toLowerCase();

function App() {
  const [isMobile, setIsMobile] = useState(false);
  const [screen, setScreen] = useState('password');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [riddleQuestion, setRiddleQuestion] = useState('Loading a new riddle...');
  const [riddleSignature, setRiddleSignature] = useState('');
  const [riddleHints, setRiddleHints] = useState([]);
  const [riddleToken, setRiddleToken] = useState('');
  const [riddleLoading, setRiddleLoading] = useState(true);
  const [riddleError, setRiddleError] = useState('');
  const [revealAnswer, setRevealAnswer] = useState('');
  const [guessCount, setGuessCount] = useState(0);
  const [hintMessage, setHintMessage] = useState('');
  const [noButtonMoved, setNoButtonMoved] = useState(false);
  const [noButtonPosition, setNoButtonPosition] = useState({ top: '50%', left: '60%' });
  const [yesButtonScale, setYesButtonScale] = useState(1);
  const [noHoverCount, setNoHoverCount] = useState(0);
  const [showFrownOverlay, setShowFrownOverlay] = useState(false);
  const [showStopOverlay, setShowStopOverlay] = useState(false);
  const [showSillyOverlay, setShowSillyOverlay] = useState(false);
  const [sillyShown, setSillyShown] = useState(false);
  const kissVideoRef = useRef(null);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  useEffect(() => {
    let active = true;

    const loadRiddle = async () => {
      setRiddleLoading(true);
      setRiddleError('');
      try {
        const response = await fetch('/api/riddle', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load riddle');
        }
        const data = await response.json();
        if (!active) return;
        setRiddleQuestion(data.question || 'Solve the riddle to continue.');
        setRiddleSignature(data.signature || '');
        setRiddleHints(Array.isArray(data.hints) ? data.hints : []);
        setRiddleToken(data.token || '');
        setRevealAnswer('');
        setGuessCount(0);
        setHintMessage('');
      } catch (err) {
        if (!active) return;
        setRiddleQuestion('Hmm, unable to load a riddle right now.');
        setRiddleError('Please refresh to try again.');
        setRiddleSignature('');
        setRiddleHints([]);
        setRiddleToken('');
        setRevealAnswer('');
        setGuessCount(0);
        setHintMessage('');
      } finally {
        if (active) {
          setRiddleLoading(false);
        }
      }
    };

    loadRiddle();
    return () => {
      active = false;
    };
  }, []);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!riddleSignature || riddleLoading) return;
    if (password === 'AbhiShreya4Eva') {
      fetch('/api/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: riddleSignature,
          token: riddleToken,
          masterPassword: password,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.answer) {
            setRevealAnswer(data.answer);
            setHintMessage('');
          } else {
            setRevealAnswer('');
            setHintMessage('No answer available.');
          }
        })
        .catch(() => {
          setRevealAnswer('');
          setHintMessage('No answer available.');
        });
      return;
    }
    setError(false);
    fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answer: normalizeAnswer(password),
        signature: riddleSignature,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ok) {
          setScreen('granted');
        } else {
          setError(true);
          const nextCount = guessCount + 1;
          setGuessCount(nextCount);
          if (riddleHints.length && nextCount % 2 === 0) {
            const hintIndex = Math.min(Math.floor(nextCount / 2) - 1, riddleHints.length - 1);
            setHintMessage(`Hint: ${riddleHints[hintIndex]}`);
          }
          setTimeout(() => setError(false), 1000);
        }
      })
      .catch(() => {
        setError(true);
        const nextCount = guessCount + 1;
        setGuessCount(nextCount);
        if (riddleHints.length && nextCount % 2 === 0) {
          const hintIndex = Math.min(Math.floor(nextCount / 2) - 1, riddleHints.length - 1);
          setHintMessage(`Hint: ${riddleHints[hintIndex]}`);
        }
        setTimeout(() => setError(false), 1000);
      });
  };

  // Auto-advance from granted screen after 2 seconds
  useEffect(() => {
    if (screen === 'granted') {
      const timer = setTimeout(() => setScreen('dialog1'), 2000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  // Show silly overlay when No button disappears (yesButtonScale >= 6)
  useEffect(() => {
    if (yesButtonScale >= 6 && !sillyShown && screen === 'question') {
      setSillyShown(true);
      setShowSillyOverlay(true);
      setTimeout(() => {
        setShowSillyOverlay(false);
      }, 3000);
    }
  }, [yesButtonScale, sillyShown, screen]);

  const handleNoHover = () => {
    // Don't do anything if overlay is showing
    if (showFrownOverlay || showStopOverlay) return;

    // Mark that the button has been interacted with
    setNoButtonMoved(true);

    // Increment hover count
    const newCount = noHoverCount + 1;
    setNoHoverCount(newCount);

    // Show frown overlay on 4th hover
    if (newCount === 4) {
      setShowFrownOverlay(true);
      setTimeout(() => {
        setShowFrownOverlay(false);
      }, 3000);
    }

    // Show STOP overlay on 6th hover
    if (newCount === 6) {
      setShowStopOverlay(true);
      setTimeout(() => {
        setShowStopOverlay(false);
      }, 3000);
    }

    // Make yes button bigger
    const newScale = yesButtonScale + 0.3;
    setYesButtonScale(newScale);

    // Calculate the danger zone (where the Yes button is)
    const centerX = 50;
    const centerY = 50;
    const dangerRadius = 10 + (newScale * 8);

    // Generate random position in the safe zones (edges/corners)
    const edge = Math.floor(Math.random() * 4);
    let newTop, newLeft;

    if (edge === 0) {
      newTop = Math.random() * 15 + 5;
      newLeft = Math.random() * 80 + 10;
    } else if (edge === 1) {
      newTop = Math.random() * 15 + 75;
      newLeft = Math.random() * 80 + 10;
    } else if (edge === 2) {
      newTop = Math.random() * 60 + 20;
      newLeft = Math.random() * 15 + 5;
    } else {
      newTop = Math.random() * 60 + 20;
      newLeft = Math.random() * 15 + 75;
    }

    const distFromCenter = Math.sqrt(
      Math.pow(newLeft - centerX, 2) + Math.pow(newTop - centerY, 2)
    );

    if (distFromCenter < dangerRadius) {
      const corner = Math.floor(Math.random() * 4);
      if (corner === 0) { newTop = 10; newLeft = 10; }
      else if (corner === 1) { newTop = 10; newLeft = 85; }
      else if (corner === 2) { newTop = 85; newLeft = 10; }
      else { newTop = 85; newLeft = 85; }
    }

    setNoButtonPosition({ top: `${newTop}%`, left: `${newLeft}%` });
  };

  const handleYesClick = () => {
    setScreen('kiss');
  };

  const handleKissLoaded = () => {
    const video = kissVideoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const startTime = Math.max(0, video.duration - 1.2);
    video.currentTime = startTime;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  };

  if (isMobile) {
    return (
      <div className="mobile-block">
        <p className="mobile-block-text">Open on a Computer Pleasee</p>
      </div>
    );
  }

  // Password Screen
  if (screen === 'password') {
    return (
      <div className="password-screen">
        <div className="password-container">
          <h1 className="password-question">{riddleQuestion}</h1>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`password-input ${error ? 'shake' : ''}`}
              placeholder="Enter password..."
              autoFocus
              disabled={riddleLoading}
            />
            <button type="submit" className="submit-btn" disabled={riddleLoading || !riddleSignature}>
              {riddleLoading ? 'Loading...' : 'Enter'}
            </button>
          </form>
          {riddleError && <p className="error-text">{riddleError}</p>}
          {hintMessage && <p className="error-text">{hintMessage}</p>}
          {revealAnswer && <p className="error-text">Answer: {revealAnswer}</p>}
          {error && <p className="error-text">Hmm, try again!</p>}
        </div>
      </div>
    );
  }

  // Access Granted Screen
  if (screen === 'granted') {
    return (
      <div className="granted-screen bee-cursor">
        <h1 className="granted-text">Access Granted</h1>
      </div>
    );
  }

  // Dialog Screens
  if (screen === 'dialog1') {
    return (
      <div className="dialog-screen bee-cursor">
        <div className="dialog-container">
          <img
            src="/hug.jpeg"
            alt="Hug"
            className="dialog-image"
          />
          <p className="dialog-text">Sooo you might know that I kind of like you</p>
          <button className="next-btn" onClick={() => setScreen('dialog2')}>
            Next
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'dialog2') {
    return (
      <div className="dialog-screen bee-cursor">
        <div className="dialog-container">
          <img
            src="/shirtless.jpeg"
            alt="Shirtless"
            className="dialog-image"
          />
          <p className="dialog-text">and i like to think you like me...</p>
          <button className="next-btn" onClick={() => setScreen('dialog3')}>
            Next
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'dialog3') {
    return (
      <div className="dialog-screen bee-cursor">
        <div className="dialog-container">
          <img
            src="/pressed.jpeg"
            alt="Pressed"
            className="dialog-image"
          />
          <p className="dialog-text">but even if you dont</p>
          <button className="next-btn" onClick={() => setScreen('dialog4')}>
            Next
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'dialog4') {
    return (
      <div className="dialog-screen bee-cursor">
        <div className="dialog-container">
          <img
            src="/okay.png"
            alt="Okay"
            className="dialog-image"
          />
          <p className="dialog-text">its okay</p>
          <button className="next-btn" onClick={() => setScreen('dialog5')}>
            Next
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'dialog5') {
    return (
      <div className="dialog-screen bee-cursor">
        <div className="dialog-container">
          <img
            src="/hownot.jpeg"
            alt="How not"
            className="dialog-image"
          />
          <p className="dialog-text">since we both know that i OBVIOUSLY like you more (how could i not shes soooooo cute, and pretty, and funny and moreeee)</p>
          <button className="next-btn" onClick={() => setScreen('dialog6')}>
            Next
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'dialog6') {
    return (
      <div className="dialog-screen bee-cursor">
        <div className="dialog-container">
          <p className="dialog-text">anyways</p>
          <button className="next-btn" onClick={() => setScreen('dialog7')}>
            Next
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'dialog7') {
    return (
      <div className="dialog-screen bee-cursor">
        <div className="dialog-container">
          <p className="dialog-text">would it maybe be possible</p>
          <button className="next-btn" onClick={() => setScreen('dialog8')}>
            Next
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'dialog8') {
    return (
      <div className="dialog-screen bee-cursor">
        <div className="dialog-container">
          <p className="dialog-text">if you're free next next weekend</p>
          <button className="next-btn" onClick={() => setScreen('dialog9')}>
            Next
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'dialog9') {
    return (
      <div className="dialog-screen bee-cursor">
        <div className="dialog-container">
          <img
            src="/glasses.jpeg"
            alt="Cool girl with glasses"
            className="dialog-image dialog-image--zoomed-out"
          />
          <p className="dialog-text">to be cool like this girl</p>
          <button className="next-btn" onClick={() => setScreen('question')}>
            Next
          </button>
        </div>
      </div>
    );
  }

  // Question Screen
  if (screen === 'question') {
    return (
      <div className="question-screen bee-cursor">
        {showFrownOverlay && (
          <div className="frown-overlay">
            <img src="/frown.png" alt="Frown" className="frown-image" />
            <p className="frown-text">Hey not cool, lets take a second to think about this</p>
          </div>
        )}
        {showStopOverlay && (
          <div className="stop-overlay">
            <img src="/frown2.jpeg" alt="Stop" className="stop-image" />
            <p className="stop-text">STOPPPPP</p>
          </div>
        )}
        {showSillyOverlay && (
          <div className="silly-overlay">
            <img src="/silly.jpeg" alt="Silly" className="silly-image" />
            <p className="silly-text">HAHA. I got you, what are you going to do now???</p>
          </div>
        )}
        <h1 className="valentine-question">and be my valentine???</h1>
        <div className={`button-container ${noButtonMoved ? 'no-moved' : 'side-by-side'}`}>
          <button
            className="yes-btn"
            style={noButtonMoved ? { transform: `scale(${yesButtonScale})` } : {}}
            onClick={handleYesClick}
          >
            Yes!
          </button>
          {yesButtonScale < 6 && (
            <button
              className="no-btn"
              style={noButtonMoved ? {
                position: 'absolute',
                top: noButtonPosition.top,
                left: noButtonPosition.left,
              } : {}}
              onMouseEnter={handleNoHover}
              onTouchStart={(e) => {
                e.preventDefault();
                handleNoHover();
              }}
            >
              No
            </button>
          )}
        </div>
      </div>
    );
  }

  if (screen === 'kiss') {
    return (
      <div className="kiss-screen bee-cursor">
        <video
          src="/kiss.MOV"
          ref={kissVideoRef}
          className="kiss-video"
          autoPlay
          muted
          playsInline
          onLoadedMetadata={handleKissLoaded}
          onEnded={() => setScreen('congrats')}
        />
      </div>
    );
  }

  // Congratulations Screen
  if (screen === 'congrats') {
    return (
      <div className="congrats-screen bee-cursor">
        <div className="congrats-content">
          <h1 className="congrats-title">YAY!</h1>
          <div className="hearts-container">
            <span className="heart">❤️</span>
            <span className="heart">💕</span>
            <span className="heart">💖</span>
            <span className="heart">💗</span>
            <span className="heart">💓</span>
          </div>
          <p className="congrats-text">I knew you'd say yes!</p>
          <p className="congrats-subtext">i love and appreciate you so much my princess, and I cant wait for you to be my valentine</p>
        </div>
      </div>
    );
  }

  return null;
}

export default App;
