from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from worker import speech_to_text, openai_process_message

app = Flask(__name__)
CORS(app)

@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')

@app.route('/speech-to-text', methods=['POST'])
def speech_to_text_route():
    """
    Route to handle speech-to-text conversion
    Since we're using browser Web Speech API, this receives already-transcribed text
    """
    try:
        # Get the text from the request (already transcribed by browser)
        data = request.get_json()
        text = data.get('text', '')
        
        print('Received text:', text)
        
        return jsonify({'text': text})
    except Exception as e:
        print(f"Error in speech-to-text route: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/process-message', methods=['POST'])
def process_prompt_route():
    """
    Route to process user message and get AI response
    """
    try:
        # Get the user message from request
        data = request.get_json()
        user_message = data.get('userMessage', '')
        
        print('Processing message:', user_message)
        
        # Get AI response from Ollama
        ai_response = openai_process_message(user_message)
        
        print('AI Response:', ai_response)
        
        return jsonify({'response': ai_response})
    except Exception as e:
        print(f"Error in process-message route: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
