import os
import sys
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv
import time

def load_api_key(env_path):
    """Load API key from .env.local file"""
    if not os.path.exists(env_path):
        print(f"Error: Environment file not found at {env_path}")
        sys.exit(1)
    
    load_dotenv(env_path)
    api_key = os.getenv('OPENAI_API_KEY')
    
    if not api_key:
        print("Error: OPENAI_API_KEY not found in .env.local file")
        print("Please add: OPENAI_API_KEY=your_key_here")
        sys.exit(1)
    
    return api_key

def chat_with_gpt(prompt, model="gpt-3.5-turbo", temperature=0.7, max_tokens=1000):
    """Send a prompt to GPT-3.5 and return the response"""
    try:
        # FIXED: Use api_key (not OPENAI_API_KEY) as parameter
        client = OpenAI(api_key=api_key)
        
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        return response.choices[0].message.content
    
    except Exception as e:
        return f"Error: {str(e)}"

def main():
    """Main function to handle command line interaction"""
    global api_key
    
    # Path to your .env.local file
    env_path = r"C:\Users\jiahu\Downloads\URECA\URECA\.env.local"
    
    # Load API key
    api_key = load_api_key(env_path)
    print("API key loaded successfully!\n")
    
    # Check if prompt is provided as command line argument
    if len(sys.argv) > 1:
        # Use command line argument as prompt
        prompt = ' '.join(sys.argv[1:])
        print(f"Prompt: {prompt}\n")
        print("Response:")
        print("-" * 50)
        response = chat_with_gpt(prompt)
        print(response)
        print("-" * 50)
    else:
        # Interactive mode
        print("GPT-3.5 Chat Interface (type 'exit' to quit)")
        print("=" * 50)
        
        while True:
            try:
                prompt = input("\nYou: ").strip()
                
                if prompt.lower() in ['exit', 'quit', 'q']:
                    print("Goodbye!")
                    break
                
                if not prompt:
                    continue
                
                print("\nGPT-3.5: ", end="")
                response = chat_with_gpt(prompt)
                print(response)
                
            except KeyboardInterrupt:
                print("\n\nGoodbye!")
                break
            except Exception as e:
                print(f"\nError: {str(e)}")

if __name__ == "__main__":
    main()