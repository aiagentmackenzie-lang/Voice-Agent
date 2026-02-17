let lightMode = true;
let recorder = null;
let recording = false;
let voiceOption = "default";
const responses = [];
const botRepeatButtonIDToIndexMap = {};
const userRepeatButtonIDToRecordingMap = {};
const baseUrl = window.location.origin;
let recognition = null;

// Initialize speech recognition
function initializeSpeechRecognition() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    return true;
  }
  return false;
}

async function showBotLoadingAnimation() {
  await sleep(500);
  $(".loading-animation").eq(0).addClass("show").css("display", "flex");
}

function hideBotLoadingAnimation() {
  $(".loading-animation").eq(0).removeClass("show").css("display", "none");
}

async function showUserLoadingAnimation() {
  await sleep(100);
  $(".loading-animation").eq(1).addClass("show").css("display", "flex");
}

function hideUserLoadingAnimation() {
  $(".loading-animation").eq(1).removeClass("show").css("display", "none");
}

const getSpeechToText = () => {
  return new Promise((resolve, reject) => {
    if (!initializeSpeechRecognition()) {
      reject("Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    let hasResult = false;

    recognition.onresult = (event) => {
      hasResult = true;
      const transcript = event.results[0][0].transcript;
      console.log('Recognized text:', transcript);
      resolve(transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        reject('No speech detected. Please try again.');
      } else if (event.error === 'audio-capture') {
        reject('Microphone not found or not accessible.');
      } else if (event.error === 'not-allowed') {
        reject('Microphone permission denied. Please allow microphone access.');
      } else {
        reject('Could not recognize speech: ' + event.error);
      }
    };

    recognition.onend = () => {
      if (!hasResult) {
        reject('Speech recognition ended without result.');
      }
    };

    try {
      recognition.start();
      console.log('Speech recognition started');
    } catch (error) {
      console.error('Error starting recognition:', error);
      reject('Could not start speech recognition: ' + error.message);
    }
  });
};

const processUserMessage = async (userMessage) => {
  let response = await fetch(baseUrl + "/process-message", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ userMessage: userMessage, voice: voiceOption }),
  });
  response = await response.json();
  console.log(response);
  
  // Adapt the response to match what the rest of the code expects
  return {
    openaiResponseText: response.response,
    openaiResponseSpeech: null // We'll add TTS later
  };
};

const cleanTextInput = (value) => {
  return value
    .trim() // remove starting and ending spaces
    .replace(/[\n\t]/g, "") // remove newlines and tabs
    .replace(/<[^>]*>/g, "") // remove HTML tags
    .replace(/[<>&;]/g, ""); // sanitize inputs
};

const recordAudio = () => {
  return new Promise(async (resolve) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks = [];

    mediaRecorder.addEventListener("dataavailable", (event) => {
      audioChunks.push(event.data);
    });

    const start = () => mediaRecorder.start();

    const stop = () =>
      new Promise((resolve) => {
        mediaRecorder.addEventListener("stop", () => {
          const audioBlob = new Blob(audioChunks, { type: "audio/mpeg" });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          const play = () => audio.play();
          resolve({ audioBlob, audioUrl, play });
        });

        mediaRecorder.stop();
      });

    resolve({ start, stop });
  });
};

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));

const toggleRecording = async () => {
  if (!recording) {
    recorder = await recordAudio();
    recording = true;
    recorder.start();
  } else {
    const audio = await recorder.stop();
    sleep(1000);
    return audio;
  }
};

const playResponseAudio = (function () {
  const df = document.createDocumentFragment();
  return function Sound(src) {
    // If src is null, use browser's speech synthesis
    if (!src || src === "data:audio/wav;base64,null") {
      return null;
    }
    const snd = new Audio(src);
    df.appendChild(snd); // keep in fragment until finished playing
    snd.addEventListener("ended", function () {
      df.removeChild(snd);
    });
    snd.play();
    return snd;
  };
})();

// Text-to-Speech using browser's Speech Synthesis API
const speakText = (text) => {
  if ('speechSynthesis' in window) {
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    window.speechSynthesis.speak(utterance);
  } else {
    console.log('Text-to-speech not supported');
  }
};

const getRandomID = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const scrollToBottom = () => {
  // Scroll the chat window to the bottom
  $("#chat-window").animate({
    scrollTop: $("#chat-window")[0].scrollHeight,
  });
};

const populateUserMessage = (userMessage, userRecording) => {
  // Clear the input field
  $("#message-input").val("");

  // Append the user's message to the message list

  if (userRecording) {
    const userRepeatButtonID = getRandomID();
    userRepeatButtonIDToRecordingMap[userRepeatButtonID] = userRecording;
    hideUserLoadingAnimation();
    $("#message-list").append(
      `<div class='message-line my-text'><div class='message-box my-text${
        !lightMode ? " dark" : ""
      }'><div class='me'>${userMessage}</div></div>
            <button id='${userRepeatButtonID}' class='btn volume repeat-button' onclick='userRepeatButtonIDToRecordingMap[this.id].play()'><i class='fa fa-volume-up'></i></button>
            </div>`
    );
  } else {
    $("#message-list").append(
      `<div class='message-line my-text'><div class='message-box my-text${
        !lightMode ? " dark" : ""
      }'><div class='me'>${userMessage}</div></div></div>`
    );
  }

  scrollToBottom();
};

const populateBotResponse = async (userMessage) => {
  await showBotLoadingAnimation();
  const response = await processUserMessage(userMessage);
  responses.push(response);

  const repeatButtonID = getRandomID();
  botRepeatButtonIDToIndexMap[repeatButtonID] = responses.length - 1;
  hideBotLoadingAnimation();
  
  // Append the response to the message list
  $("#message-list").append(
    `<div class='message-line'><div class='message-box${
      !lightMode ? " dark" : ""
    }'>${
      response.openaiResponseText
    }</div><button id='${repeatButtonID}' class='btn volume repeat-button' onclick='speakText(responses[botRepeatButtonIDToIndexMap[this.id]].openaiResponseText)'><i class='fa fa-volume-up'></i></button></div>`
  );

  // Speak the response using browser TTS
  speakText(response.openaiResponseText);

  scrollToBottom();
};

$(document).ready(function () {
  // Check if speech recognition is supported
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    console.warn('Speech recognition not supported in this browser');
  }

  // Listen for the "Enter" key being pressed in the input field
  $("#message-input").keyup(function (event) {
    let inputVal = cleanTextInput($("#message-input").val());

    if (event.keyCode === 13 && inputVal != "") {
      const message = inputVal;

      populateUserMessage(message, null);
      populateBotResponse(message);
    }

    inputVal = $("#message-input").val();

    if (inputVal == "" || inputVal == null) {
      $("#send-button")
        .removeClass("send")
        .addClass("microphone")
        .html("<i class='fa fa-microphone'></i>");
    } else {
      $("#send-button")
        .removeClass("microphone")
        .addClass("send")
        .html("<i class='fa fa-paper-plane'></i>");
    }
  });

  // When the user clicks the "Send" button
  $("#send-button").click(async function () {
    if ($("#send-button").hasClass("microphone") && !recording) {
      // Start voice recording
      recording = true;
      $(".fa-microphone").css("color", "#f44336");
      console.log("Start listening...");
      
      showUserLoadingAnimation();
      
      try {
        const userMessage = await getSpeechToText();
        hideUserLoadingAnimation();
        
        if (userMessage && userMessage.trim() !== "") {
          populateUserMessage(userMessage, null);
          await populateBotResponse(userMessage);
        }
      } catch (error) {
        console.error("Speech recognition error:", error);
        hideUserLoadingAnimation();
        alert(error);
      }
      
      $(".fa-microphone").css("color", "#125ee5");
      recording = false;
      
    } else if (recording) {
      // This shouldn't happen with the new implementation, but keeping for safety
      recording = false;
      $(".fa-microphone").css("color", "#125ee5");
      hideUserLoadingAnimation();
    } else {
      // Get the message the user typed in
      const message = cleanTextInput($("#message-input").val());

      if (message && message.trim() !== "") {
        populateUserMessage(message, null);
        populateBotResponse(message);
      }

      $("#send-button")
        .removeClass("send")
        .addClass("microphone")
        .html("<i class='fa fa-microphone'></i>");
    }
  });

  // handle the event of switching light-dark mode
  $("#light-dark-mode-switch").change(function () {
    $("body").toggleClass("dark-mode");
    $(".message-box").toggleClass("dark");
    $(".loading-dots").toggleClass("dark");
    $(".dot").toggleClass("dark-dot");
    lightMode = !lightMode;
  });

  $("#voice-options").change(function () {
    voiceOption = $(this).val();
    console.log(voiceOption);
  });
});
