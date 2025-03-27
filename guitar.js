document.addEventListener('DOMContentLoaded', () => {
    const tuningSelect = document.getElementById('tuning-select');
    const statusMessage = document.getElementById('status-message');
    const micToggleButton = document.getElementById('mic-toggle');
    const detectedNoteDisplay = document.getElementById('detected-note');
    const detectedFreqDisplay = document.getElementById('detected-freq');
    const indicatorNeedle = document.getElementById('indicator-needle');
    const tabs = document.querySelectorAll('.tab');
    
    // Define dummy strings since we removed the physical string elements
    const strings = [null, null, null, null, null, null];
    
    // Get all note circles
    const noteCircles = document.querySelectorAll('.note-circle');
    
    // Track which strings have been tuned
    let tunedStrings = [false, false, false, false, false, false];
    
    // Get the tuning complete popup
    const tuningCompletePopup = document.querySelector('.tuning-complete');

    // Create tuning circles if not already present in the HTML
    const guitarVisualizer = document.querySelector('.guitar-visualizer');
    if (!document.querySelector('.tuning-circles')) {
        const tuningCircles = document.createElement('div');
        tuningCircles.className = 'tuning-circles';
        
        // Create circles for each note
        const standardTuning = ['E', 'A', 'D', 'G', 'B', 'E'];
        
        standardTuning.forEach((note, index) => {
            const noteCircle = document.createElement('div');
            noteCircle.className = 'note-circle';
            noteCircle.textContent = note;
            noteCircle.dataset.note = note;
            noteCircle.dataset.string = index;
            
            // Add click handler for the note circle
            noteCircle.addEventListener('click', function() {
                // Find which string this corresponds to in the current tuning
                const stringIndex = this.dataset.string;
                const noteName = this.textContent;
                
                // Get the frequency for this note
                const frequency = getFrequencyFromNoteName(noteName);
                
                // Play the tone
                playTone(frequency, noteName, this, stringIndex);
            });
            
            tuningCircles.appendChild(noteCircle);
        });
        
        guitarVisualizer.appendChild(tuningCircles);
    }

    // --- Tab Navigation Setup ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // If we're on the "Create your own tabs" tab, we would show that interface
            // For now, just show a message
            if (tab.textContent.includes('Create your own tabs')) {
                statusMessage.textContent = "Tab creation feature coming soon!";
                statusMessage.style.color = "rgba(255, 255, 255, 0.9)";
                // Hide tuner controls when in tab creation mode
                document.querySelector('.tuner-controls-panel').style.opacity = "0.5";
                document.querySelector('.tuner-controls-panel').style.pointerEvents = "none";
            } else {
                statusMessage.textContent = "Ready to tune your guitar";
                statusMessage.style.color = "rgba(255, 255, 255, 0.9)";
                // Show tuner controls when in tuning mode
                document.querySelector('.tuner-controls-panel').style.opacity = "1";
                document.querySelector('.tuner-controls-panel').style.pointerEvents = "auto";
            }
        });
    });

    // --- Audio Setup ---
    let audioContext;
    let oscillator;
    let gainNode;
    let isAudioReady = false;
    let activeElement = null; // Keep track of the active element (string or note)
    
    // --- Microphone Setup ---
    let micStream = null;
    let analyzer = null;
    let isListening = false;
    let pitchDetectionInterval = null;
    let audioData = null;
    
    // --- Pitch Detection Variables ---
    const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const A4 = 440; // Reference frequency for A4 note
    const DETECTION_THRESHOLD = 0.001; // Lower threshold for better sensitivity

    // Debug option - set to true to see console logging
    const DEBUG_MODE = true;

    // Function to initialize Audio Context on first user interaction
    function initAudioContext() {
        if (!audioContext && window.AudioContext || window.webkitAudioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            gainNode = audioContext.createGain();
            gainNode.gain.value = 0; // Start silent
            gainNode.connect(audioContext.destination);
            isAudioReady = true;
            console.log("AudioContext Initialized.");
        } else if (!isAudioReady) {
            statusMessage.textContent = "Web Audio API not supported in this browser.";
            statusMessage.style.color = "#ff6b6b";
        }
    }

    // --- Tuning Data --- (Add more tunings as needed!)
    const tunings = {
        standard: {
            name: "Standard (E A D G B E)",
            notes: [
                { string: 6, note: 'E2', freq: 82.41 },
                { string: 5, note: 'A2', freq: 110.00 },
                { string: 4, note: 'D3', freq: 146.83 },
                { string: 3, note: 'G3', freq: 196.00 },
                { string: 2, note: 'B3', freq: 246.94 },
                { string: 1, note: 'E4', freq: 329.63 }
            ]
        },
        drop_d: {
            name: "Drop D (D A D G B E)",
            notes: [
                { string: 6, note: 'D2', freq: 73.42 },
                { string: 5, note: 'A2', freq: 110.00 },
                { string: 4, note: 'D3', freq: 146.83 },
                { string: 3, note: 'G3', freq: 196.00 },
                { string: 2, note: 'B3', freq: 246.94 },
                { string: 1, note: 'E4', freq: 329.63 }
            ]
        },
        open_g: {
            name: "Open G (D G D G B D)",
            notes: [
                { string: 6, note: 'D2', freq: 73.42 },
                { string: 5, note: 'G2', freq: 98.00 },
                { string: 4, note: 'D3', freq: 146.83 },
                { string: 3, note: 'G3', freq: 196.00 },
                { string: 2, note: 'B3', freq: 246.94 },
                { string: 1, note: 'D4', freq: 293.66 }
            ]
        },
         open_d: {
            name: "Open D (D A D F# A D)",
            notes: [
                { string: 6, note: 'D2', freq: 73.42 },
                { string: 5, note: 'A2', freq: 110.00 },
                { string: 4, note: 'D3', freq: 146.83 },
                { string: 3, note: 'F#3', freq: 185.00 },
                { string: 2, note: 'A3', freq: 220.00 },
                { string: 1, note: 'D4', freq: 293.66 }
            ]
        },
        dadgad: {
             name: "DADGAD",
            notes: [
                { string: 6, note: 'D2', freq: 73.42 },
                { string: 5, note: 'A2', freq: 110.00 },
                { string: 4, note: 'D3', freq: 146.83 },
                { string: 3, note: 'G3', freq: 196.00 },
                { string: 2, note: 'A3', freq: 220.00 },
                { string: 1, note: 'D4', freq: 293.66 }
            ]
        },
        // Add more tunings here...
         eb_standard: {
            name: "Eb Standard (Eb Ab Db Gb Bb Eb)",
            notes: [
                { string: 6, note: 'Eb2', freq: 77.78 },
                { string: 5, note: 'Ab2', freq: 103.83 },
                { string: 4, note: 'Db3', freq: 138.59 },
                { string: 3, note: 'Gb3', freq: 185.00 },
                { string: 2, note: 'Bb3', freq: 233.08 },
                { string: 1, note: 'Eb4', freq: 311.13 }
            ]
        },
    };

    let currentTuning = tunings.standard; // Default tuning

    // --- Functions ---

    function populateTuningSelector() {
        for (const key in tunings) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = tunings[key].name;
            tuningSelect.appendChild(option);
        }
    }

    function updateStringButtons() {
        // Update the note circles and string elements based on current tuning
        currentTuning.notes.forEach((noteData, index) => {
            // Find note circle with matching data-string attribute
            const noteCircle = document.querySelector(`.note-circle[data-string="${index}"]`);
            if (noteCircle) {
                // Update the note letter display
                noteCircle.textContent = noteData.note.slice(0, -1); // Display note name (e.g., E, A, D)
                
                // Add click listener for the note circle
                noteCircle.onclick = () => {
                    if (!isAudioReady) {
                        initAudioContext();
                    }
                    if (!isAudioReady) return;
                    
                    const freq = noteData.freq;
                    const noteName = noteData.note;
                    playTone(freq, noteName, noteCircle, index);
                };
            }
        });
    }

    function playTone(frequency, noteName, element, stringIndex) {
        if (!audioContext) return;

        const duration = 1.5; // seconds
        const fadeDuration = 0.1; // seconds for fade in/out

        // Stop previous tone smoothly
        stopTone();

        oscillator = audioContext.createOscillator();
        oscillator.type = 'sine'; // 'sine', 'square', 'sawtooth', 'triangle'
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

        // Start gain at 0, ramp up quickly, hold, then ramp down
        gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + fadeDuration); // Ramp up to 50% volume
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime + duration - fadeDuration); // Hold volume
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration); // Ramp down to 0

        oscillator.connect(gainNode);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration); // Schedule stop

        statusMessage.textContent = `Playing: ${noteName} (${frequency.toFixed(2)} Hz)`;
        statusMessage.style.color = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');

        // Visual Feedback - highlight both the element clicked and the corresponding string
        element.classList.add('playing');
        activeElement = element;
        
        // Also highlight the string if a note circle was clicked
        if (element.classList.contains('note-circle')) {
            strings[stringIndex].classList.add('playing');
        }
        // If a string was clicked, also highlight the note
        else if (element.classList.contains('string')) {
            document.querySelector(`.note-circle[data-string="${stringIndex}"]`).classList.add('playing');
        }

        // Clean up visuals after tone stops
        oscillator.onended = () => {
            stopToneVisuals();
            if (oscillator && !oscillator.context) {
                statusMessage.textContent = "Ready";
                statusMessage.style.color = "#999";
            }
        };
    }

    function stopTone() {
        if (oscillator) {
            try {
                // Smoothly stop the sound using the gain node
                gainNode.gain.cancelScheduledValues(audioContext.currentTime);
                gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
                oscillator.stop(audioContext.currentTime + 0.15);
            } catch (e) {
                console.warn("Error stopping oscillator:", e);
            }
            oscillator = null;
        }
        stopToneVisuals();
    }

    function stopToneVisuals() {
        // Remove playing class from all note circles but preserve tuned status
        if (noteCircles && noteCircles.length) {
            noteCircles.forEach(circle => {
                circle.classList.remove('playing');
                circle.classList.remove('perfect-match');
                
                // Only reset styles if not already tuned
                if (!circle.classList.contains('tuned')) {
                    // Reset any applied styles
                    circle.style.backgroundColor = '';
                    circle.style.color = '';
                    circle.style.boxShadow = '';
                }
            });
        }
        
        // Remove playing and perfect match classes from all 3D fretboard strings
        document.querySelectorAll('.guitar-string').forEach(string => {
            string.classList.remove('playing');
            string.classList.remove('perfect-match');
        });
        
        activeElement = null;
    }

    // --- Event Listeners ---
    tuningSelect.addEventListener('change', (event) => {
        const selectedTuningKey = event.target.value;
        currentTuning = tunings[selectedTuningKey];
        stopTone();
        
        // Reset tuned status
        tunedStrings.fill(false);
        
        // Clear tuned classes from note circles
        noteCircles.forEach(circle => {
            circle.classList.remove('tuned', 'playing', 'perfect-match');
            circle.style.backgroundColor = '';
            circle.style.color = '';
            circle.style.boxShadow = '';
        });
        
        updateStringButtons();
        statusMessage.textContent = "Ready to tune your guitar";
        statusMessage.style.color = "rgba(255, 255, 255, 0.9)";
    });
    
    // Microphone toggle button event listener
    micToggleButton.addEventListener('click', async () => {
        if (!isAudioReady) {
            initAudioContext();
            if (!isAudioReady) return;
        }
        
        if (!isListening) {
            try {
                await startListening();
                micToggleButton.textContent = "Stop Listening";
                micToggleButton.classList.add('listening');
                statusMessage.textContent = "Listening to your guitar... pluck a string!";
                statusMessage.style.color = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
                
                // Display initial instructions
                detectedNoteDisplay.textContent = "--";
                detectedFreqDisplay.textContent = "Pluck a string";
            } catch (error) {
                console.error("Error accessing microphone:", error);
                statusMessage.textContent = error.message || "Error accessing microphone. Check permissions.";
                statusMessage.style.color = "#ff6b6b";
            }
        } else {
            stopListening();
            micToggleButton.textContent = "Start Listening";
            micToggleButton.classList.remove('listening');
            statusMessage.textContent = "Ready";
            statusMessage.style.color = "#999";
        }
    });

    // --- Initialization ---
    populateTuningSelector();
    updateStringButtons(); // Initial setup for default tuning (Standard)

    // Attempt to initialize AudioContext silently first - might work in some environments
    // try { initAudioContext(); } catch(e) {}
    // More robust: Add listeners to initialize on first interaction anywhere reasonable
    document.body.addEventListener('click', initAudioContext, { once: true });
    document.body.addEventListener('touchstart', initAudioContext, { once: true });

    statusMessage.textContent = "Click a string button to start";

    // --- Pitch Detection Functions ---
    
    // Start listening to microphone input
    async function startListening() {
        if (!audioContext) return;
        
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                    latency: 0
                } 
            });
            const micSource = audioContext.createMediaStreamSource(micStream);
            
            analyzer = audioContext.createAnalyser();
            analyzer.fftSize = 4096; // Larger FFT for better low-frequency resolution
            analyzer.smoothingTimeConstant = 0.4; // Less smoothing for quicker response
            
            micSource.connect(analyzer);
            
            audioData = new Float32Array(analyzer.fftSize);
            
            isListening = true;
            
            // Start regular pitch detection with higher frequency (60ms instead of 100ms)
            pitchDetectionInterval = setInterval(detectPitch, 60);
            
            return true;
        } catch (error) {
            console.error("Error starting microphone:", error);
            
            // Handle common errors with user-friendly messages
            let errorMessage = "Error accessing microphone. Check permissions.";
            
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage = "Microphone access denied. Please allow microphone access in your browser settings.";
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage = "No microphone found. Please connect a microphone and try again.";
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMessage = "Cannot access microphone. It may be in use by another application.";
            } else if (error.name === 'AbortError') {
                errorMessage = "Microphone access was aborted. Please try again.";
            }
            
            statusMessage.textContent = errorMessage;
            statusMessage.style.color = "#ff6b6b";
            
            throw { message: errorMessage, originalError: error };
        }
    }
    
    // Stop listening to microphone input
    function stopListening() {
        if (pitchDetectionInterval) {
            clearInterval(pitchDetectionInterval);
            pitchDetectionInterval = null;
        }
        
        if (micStream) {
            micStream.getTracks().forEach(track => track.stop());
            micStream = null;
        }
        
        isListening = false;
        
        // Reset display
        detectedNoteDisplay.textContent = "--";
        detectedFreqDisplay.textContent = "-- Hz";
        indicatorNeedle.style.left = "50%";
        
        // Reset string and note highlights
        stopToneVisuals();
    }
    
    // Detect pitch from audio input
    function detectPitch() {
        if (!analyzer || !isListening) return;
        
        analyzer.getFloatTimeDomainData(audioData);
        
        const pitch = autoCorrelate(audioData, audioContext.sampleRate);
        
        if (pitch > 50 && pitch < 1500) { // Wider frequency range for all guitar notes
            // We have a valid pitch
            const note = getNote(pitch);
            const noteName = noteStrings[note.note % 12];
            const octave = Math.floor(note.note / 12) - 1;
            const fullNoteName = noteName + octave;
            
            // Display the detected note and frequency
            detectedNoteDisplay.textContent = noteName;
            detectedFreqDisplay.textContent = `${pitch.toFixed(1)} Hz`;
            
            // Show how in-tune the note is
            const centsOff = note.cents;
            const needlePosition = 50 + (centsOff / 50 * 30); // Map cents to position (max 30% either way)
            indicatorNeedle.style.left = `${Math.max(20, Math.min(80, needlePosition))}%`;
            
            // Indicate if the note is in tune (increased tolerance to 10 cents)
            if (Math.abs(centsOff) < 10) {
                indicatorNeedle.style.backgroundColor = '#4ecca3'; // Green for in tune
            } else {
                indicatorNeedle.style.backgroundColor = 
                    centsOff < 0 ? '#ff9e7a' : '#7a9eff'; // Different colors for flat/sharp
            }
            
            // Find and highlight the closest string in our tuning with increased tolerance
            findClosestStringNote(pitch);
        } else {
            // No valid pitch detected - but don't clear immediately to avoid flickering
            // Only clear display if we've had no signal for a few frames
            if (!window.clearDisplayTimeout) {
                window.clearDisplayTimeout = setTimeout(() => {
                    detectedNoteDisplay.textContent = "--";
                    detectedFreqDisplay.textContent = "-- Hz";
                    indicatorNeedle.style.left = "50%";
                    indicatorNeedle.style.backgroundColor = "var(--primary-color)";
                    
                    // Remove any highlights when no pitch detected
                    stopToneVisuals();
                    
                    window.clearDisplayTimeout = null;
                }, 300); // Small delay before clearing display
            }
        }
    }
    
    // Find the closest note in our tuning and highlight it
    function findClosestStringNote(detectedFrequency) {
        let closestString = -1;
        let closestDifference = Infinity;
        let matchedNote = '';
        
        // Only remove playing class but keep tuned class
        document.querySelectorAll('.note-circle').forEach(circle => {
            circle.classList.remove('playing');
            circle.classList.remove('perfect-match');
            
            // Only reset styles if not already tuned
            if (!circle.classList.contains('tuned')) {
                circle.style.backgroundColor = '';
                circle.style.color = '';
                circle.style.boxShadow = '';
            }
        });
        
        document.querySelectorAll('.guitar-string').forEach(string => {
            string.classList.remove('playing');
            string.classList.remove('perfect-match');
        });
        
        // Find the string with the closest frequency
        for (let i = 0; i < currentTuning.notes.length; i++) {
            const stringFreq = currentTuning.notes[i].freq;
            const noteName = currentTuning.notes[i].note;
            
            // Skip if this string is already tuned
            if (tunedStrings[i]) continue;
            
            // Calculate cents difference (logarithmic scale)
            const centsOff = 1200 * Math.log2(detectedFrequency / stringFreq);
            
            // Allow matching within 150 cents (1.5 semitones) for better tolerance
            if (Math.abs(centsOff) < Math.abs(closestDifference) && Math.abs(centsOff) < 150) {
                closestString = i;
                closestDifference = centsOff;
                matchedNote = noteName;
            }
        }
        
        // Highlight the closest string if found
        if (closestString >= 0) {
            if (DEBUG_MODE) {
                console.log(`Detected string ${closestString}, frequency: ${detectedFrequency.toFixed(2)}Hz`);
                console.log(`Target note: ${currentTuning.notes[closestString].note}, frequency: ${currentTuning.notes[closestString].freq}Hz`);
                console.log(`Cents off: ${closestDifference.toFixed(2)}`);
            }

            // Get the corresponding string NUMBER (6=low E, 1=high E)
            const stringNumber = 6 - closestString;
            
            // Get the matching fretboard string (1=high E, 6=low E)
            const fretboardStringClass = `string-${stringNumber}`;
            const fretboardString = document.querySelector(`.guitar-string.${fretboardStringClass}`);
            
            if (DEBUG_MODE) {
                console.log(`Looking for string element with class: .guitar-string.${fretboardStringClass}`);
                console.log(`Found element:`, fretboardString);
            }
            
            // Determine how close we are to the target note
            const inTuneTolerance = 15; // cents
            const perfectTolerance = 5; // cents
            
            // Get the note circle for this string
            const noteCircle = document.querySelector(`.note-circle[data-string="${closestString}"]`);
            
            // Check if we have a perfect match
            const isPerfectMatch = Math.abs(closestDifference) < perfectTolerance;
            
            // Animate the string in the 3D fretboard
            if (fretboardString) {
                // Add playing class to the detected string
                fretboardString.classList.add('playing');
                
                // If perfectly matched, add the perfect-match class too
                if (isPerfectMatch) {
                    fretboardString.classList.add('perfect-match');
                }
            }
            
            // Also style the note circle when perfectly in tune
            if (noteCircle) {
                // Skip animation if already tuned
                if (!tunedStrings[closestString]) {
                    noteCircle.classList.add('playing');
                }
                
                // Apply green color for perfect match
                if (isPerfectMatch) {
                    // If not already marked as tuned
                    if (!tunedStrings[closestString]) {
                        // Mark this string as tuned
                        tunedStrings[closestString] = true;
                        
                        // Add the tuned class (permanent green state)
                        noteCircle.classList.add('tuned');
                        noteCircle.classList.remove('playing', 'perfect-match');
                        
                        // Play a success sound when perfectly in tune
                        if (audioContext && isAudioReady) {
                            playSuccessSound();
                        }
                        
                        // Check if all strings are tuned
                        checkAllTuned();
                        
                        console.log("String " + closestString + " is now tuned!");
                    }
                }
            }
            
            // Clear any existing timeout to prevent flicker
            if (window.clearDisplayTimeout) {
                clearTimeout(window.clearDisplayTimeout);
                window.clearDisplayTimeout = null;
            }
            
            // Update status message based on how in-tune
            if (Math.abs(closestDifference) < inTuneTolerance) {
                statusMessage.textContent = `String ${stringNumber} (${matchedNote}) is in tune!`;
                statusMessage.style.color = '#4ecca3'; // Green for in tune
            } else {
                // Show direction to tune with clear language
                const direction = closestDifference < 0 ? "Tune higher ↑" : "Tune lower ↓";
                statusMessage.textContent = `String ${stringNumber} (${matchedNote}): ${direction}`;
                statusMessage.style.color = closestDifference < 0 ? '#ff9e7a' : '#7a9eff';
            }
        }
    }
    
    // Function to check if all strings are tuned
    function checkAllTuned() {
        if (tunedStrings.every(tuned => tuned)) {
            // All strings are tuned!
            const tuningComplete = document.querySelector('.tuning-complete');
            tuningComplete.classList.add('show');
            
            // Play a success chord
            playCompletionSound();
            
            // Hide the message after 5 seconds
            setTimeout(() => {
                tuningComplete.classList.remove('show');
            }, 5000);
        }
    }
    
    // Play a success sound when all strings are tuned
    function playCompletionSound() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Play a simple chord
        const notes = [329.63, 392.00, 493.88]; // E4, G4, B4 (simple E minor chord)
        
        notes.forEach((frequency, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = 'triangle';
            oscillator.frequency.value = frequency;
            
            gainNode.gain.value = 0.2;
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start();
            
            // Stagger the notes slightly
            setTimeout(() => {
                gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 1.5);
                setTimeout(() => oscillator.stop(), 1500);
            }, index * 200);
        });
    }
    
    // Play a success sound when a string is tuned perfectly
    function playSuccessSound() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 880; // A5
        
        gainNode.gain.value = 0.1;
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.5);
        setTimeout(() => oscillator.stop(), 500);
    }
    
    // Autocorrelation algorithm for pitch detection - improved version
    function autoCorrelate(buffer, sampleRate) {
        const bufferSize = buffer.length;
        const minFreq = 60; // Even lower threshold to catch very detuned strings
        const maxFreq = 1500; // Maximum frequency we care about (higher than highest guitar note)
        const maxSamples = Math.floor(sampleRate / minFreq);
        const minSamples = Math.floor(sampleRate / maxFreq);
        
        // Check if we have enough samples for the lowest frequency
        if (bufferSize < maxSamples) {
            return -1;
        }
        
        // Check if there's enough signal (RMS)
        let rms = 0;
        for (let i = 0; i < bufferSize; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / bufferSize);
        
        // Require minimum volume (using our constant)
        if (rms < DETECTION_THRESHOLD) {
            return -1;
        }
        
        // Apply simple high-pass filtering to reduce low frequency noise
        let filteredBuffer = new Float32Array(bufferSize);
        let prevSample = 0;
        const filterCoeff = 0.95; // Adjust if needed
        
        for (let i = 0; i < bufferSize; i++) {
            filteredBuffer[i] = buffer[i] - prevSample * filterCoeff;
            prevSample = buffer[i];
        }
        
        // Find local maximum in autocorrelation function
        let bestOffset = -1;
        let bestCorrelation = 0;
        let correlation = 0;
        
        // Skip the first few offsets to avoid false positives
        const startOffset = Math.max(8, minSamples);
        
        for (let offset = startOffset; offset < maxSamples; offset++) {
            correlation = 0;
            
            // Calculate normalized autocorrelation at this offset
            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
            
            for (let i = 0; i < bufferSize - offset; i++) {
                const x = filteredBuffer[i];
                const y = filteredBuffer[i + offset];
                
                sumX += x;
                sumY += y;
                sumXY += x * y;
                sumX2 += x * x;
                sumY2 += y * y;
            }
            
            const samplesCount = bufferSize - offset;
            
            // Calculate normalized correlation coefficient (Pearson)
            const denominator = Math.sqrt((sumX2 - (sumX * sumX) / samplesCount) * 
                               (sumY2 - (sumY * sumY) / samplesCount));
            
            if (denominator > 0) {
                correlation = (sumXY - (sumX * sumY) / samplesCount) / denominator;
            }
            
            // Update best correlation if found
            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
            }
            
            // Early termination if we found a very good correlation
            if (correlation > 0.9) {
                break;
            }
        }
        
        // Verify we found a good enough correlation
        if (bestCorrelation > 0.4) {
            // Parabolic interpolation for better frequency accuracy
            let peakX = bestOffset;
            
            if (bestOffset > 0 && bestOffset < maxSamples - 1) {
                // Create a quadratic fit around the peak
                const y1 = getCorrelationAtOffset(filteredBuffer, bestOffset - 1, bufferSize);
                const y2 = bestCorrelation;
                const y3 = getCorrelationAtOffset(filteredBuffer, bestOffset + 1, bufferSize);
                
                // Use quadratic interpolation to find better peak
                const a = (y3 - 2 * y2 + y1) / 2;
                if (a < 0) { // Make sure it's a peak, not a valley
                    const b = (y3 - y1) / 2;
                    const peak_offset = -b / (2 * a);
                    
                    // Only use the interpolated value if it's reasonable
                    if (Math.abs(peak_offset) < 1) {
                        peakX = bestOffset + peak_offset;
                    }
                }
            }
            
            return sampleRate / peakX;
        }
        
        return -1;
    }
    
    // Helper function for autocorrelation
    function getCorrelationAtOffset(buffer, offset, bufferSize) {
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        const sampleCount = bufferSize - offset;
        
        for (let i = 0; i < sampleCount; i++) {
            const x = buffer[i];
            const y = buffer[i + offset];
            
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
            sumY2 += y * y;
        }
        
        const denominator = Math.sqrt((sumX2 - (sumX * sumX) / sampleCount) * 
                         (sumY2 - (sumY * sumY) / sampleCount));
        
        if (denominator > 0) {
            return (sumXY - (sumX * sumY) / sampleCount) / denominator;
        }
        
        return 0;
    }
    
    // Calculate which note a frequency corresponds to
    function getNote(frequency) {
        // Calculate how many half-steps away from A4 this frequency is
        const semitonesFromA4 = 12 * Math.log2(frequency / A4);
        const roundedSemitones = Math.round(semitonesFromA4);
        const cents = (semitonesFromA4 - roundedSemitones) * 100;
        
        // Get the note number (0-11) where 0 is C
        const noteNumber = (9 + roundedSemitones) % 12; // A is 9 semitones from C
        
        // Calculate octave (A4 is in octave 4)
        const octave = 4 + Math.floor((roundedSemitones + 9) / 12);
        
        return {
            note: noteNumber + (octave * 12),
            cents: cents
        };
    }
    
    // Convert a note name to its frequency
    function getFrequencyFromNoteName(noteName) {
        // Parse the note name to extract note and octave
        const matches = noteName.match(/([A-G][#b]?)(\d+)/);
        if (!matches) return -1;
        
        const noteStr = matches[1];
        const octave = parseInt(matches[2]);
        
        // Find the note index
        let noteIndex = -1;
        for (let i = 0; i < noteStrings.length; i++) {
            if (noteStr === noteStrings[i]) {
                noteIndex = i;
                break;
            }
        }
        
        if (noteIndex === -1) return -1;
        
        // Calculate frequency from note index and octave
        const semitonesFromA4 = (octave - 4) * 12 + noteIndex - 9; // A is 9 semitones from C
        return A4 * Math.pow(2, semitonesFromA4 / 12);
    }

    // Add event listeners to the note buttons
    const noteButtons = []; // Empty array since we removed the buttons from the HTML
    
    // Note to frequency mapping
    const noteFrequencies = {
        'E2': 82.41, // Low E (6th string)
        'A2': 110.00,
        'D3': 146.83,
        'G3': 196.00,
        'B3': 246.94,
        'E4': 329.63  // High E (1st string)
    };
    
    // Map tuning string indices to 3D fretboard string elements
    const stringMapping = {
        0: 'string-6', // Low E (6th string)
        1: 'string-5', // A (5th string)
        2: 'string-4', // D (4th string)
        3: 'string-3', // G (3rd string)
        4: 'string-2', // B (2nd string)
        5: 'string-1'  // High E (1st string)
    };

    // Map note names to 3D fretboard note button indices
    const noteNameToButtonIndex = {
        'E2': 0, // Low E
        'A2': 1,
        'D3': 2,
        'G3': 3,
        'B3': 4,
        'E4': 5  // High E
    };

    // At the end of the DOMContentLoaded event handler, add this function to test the visualization
    
    // Debug function to manually trigger a perfect match for testing
    window.testPerfectMatch = function(stringIndex) {
        if (stringIndex === undefined) stringIndex = 0; // Default to low E string
        
        // Get the note circle
        const noteCircle = document.querySelector(`.note-circle[data-string="${stringIndex}"]`);
        if (noteCircle) {
            console.log("Testing perfect match on note circle:", noteCircle);
            
            // Apply green styling
            noteCircle.style.backgroundColor = '#4ecca3';
            noteCircle.style.color = 'white';
            noteCircle.style.boxShadow = '0 0 20px rgba(78, 204, 163, 0.7)';
            
            // Log current computed style to check what's actually being applied
            const computedStyle = window.getComputedStyle(noteCircle);
            console.log("Computed style:", {
                backgroundColor: computedStyle.backgroundColor,
                color: computedStyle.color,
                boxShadow: computedStyle.boxShadow
            });
            
            // Update status for user
            statusMessage.textContent = "Debug: Applied green color to note circle " + stringIndex;
        } else {
            console.error("Could not find note circle with data-string=", stringIndex);
            statusMessage.textContent = "Error: Could not find note circle " + stringIndex;
        }
    };
    
    console.log("Guitar tuner initialized. Call window.testPerfectMatch(0-5) to test note circle coloring.");

    // Set up the reset button functionality
    const resetButton = document.getElementById('reset-tuning');
    resetButton.addEventListener('click', resetTuning);
    
    // Function to reset all tuning status
    function resetTuning() {
        // Reset the tunedStrings array
        for (let i = 0; i < tunedStrings.length; i++) {
            tunedStrings[i] = false;
        }
        
        // Remove all classes and reset styles for the note circles
        const noteCircles = document.querySelectorAll('.note-circle');
        noteCircles.forEach(circle => {
            // Remove all status classes
            circle.classList.remove('tuned');
            circle.classList.remove('playing');
            circle.classList.remove('perfect-match');
            
            // Reset all inline styles that might have been applied
            circle.style.backgroundColor = '';
            circle.style.color = '';
            circle.style.boxShadow = '';
            circle.style.textShadow = '';
            circle.style.transform = '';
            
            // Force the original styling by removing and re-adding the class
            circle.className = 'note-circle';
        });
        
        // Remove playing class from 3D fretboard strings
        const strings = document.querySelectorAll('.guitar-string');
        strings.forEach(string => {
            string.classList.remove('playing');
            string.classList.remove('perfect-match');
        });
        
        // Reset note buttons if they exist
        const noteButtons = document.querySelectorAll('.note-button');
        noteButtons.forEach(button => {
            button.classList.remove('active');
            button.classList.remove('perfect-match');
        });
        
        // Hide the tuning needle
        const tuningNeedle = document.getElementById('indicator-needle');
        if (tuningNeedle) {
            tuningNeedle.style.display = 'none';
        }
        
        // Reset detected note and frequency display
        const detectedNoteDisplay = document.getElementById('detected-note');
        const detectedFrequencyDisplay = document.getElementById('detected-freq');
        if (detectedNoteDisplay) detectedNoteDisplay.textContent = '--';
        if (detectedFrequencyDisplay) detectedFrequencyDisplay.textContent = '-- Hz';
        
        // Update the status message
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) {
            statusMessage.textContent = 'Ready to tune your guitar again';
            statusMessage.style.color = 'rgba(255, 255, 255, 0.9)';
        }
        
        console.log('Tuning has been reset');
    }
});