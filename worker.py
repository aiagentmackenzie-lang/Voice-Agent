import requests
import json

def speech_to_text(audio_binary):
    """
    For local development, we'll handle speech-to-text in the browser
    using the Web Speech API, so this function will just pass through
    the text that's already been transcribed by the browser.
    """
    # In our implementation, the audio will already be converted to text
    # by the browser's Web Speech API before reaching here
    return audio_binary

def openai_process_message(user_message):
    """
    Process message using Ollama running locally instead of OpenAI
    """
    # Set the prompt for Ollama
    prompt = "Act like a personal assistant. You can respond to questions, translate sentences, summarize news, and give recommendations. Keep responses concise - 2 to 3 sentences maximum."
    
    # Ollama API endpoint (make sure Ollama is running locally)
    ollama_url = "http://localhost:11434/api/generate"
    
    # Prepare the request payload
    payload = {
        "model": "deepseek-r1:8b",
        "prompt": f"{prompt}\n\nUser: {user_message}\n\nAssistant:",
        "stream": False
    }
    
    try:
        # Call Ollama API
        response = requests.post(ollama_url, json=payload)
        response_data = response.json()
        
        print("Ollama response:", response_data)
        
        # Extract the response text
        response_text = response_data.get('response', 'Sorry, I could not process that.')
        
        return response_text
        
    except Exception as e:
        print(f"Error calling Ollama: {e}")
        return "Sorry, I'm having trouble connecting to the AI model. Make sure Ollama is running."
