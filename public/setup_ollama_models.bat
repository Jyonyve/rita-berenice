@echo off
echo Setting up Ollama with exaone-deep:2.4b and gemma3-1b-Q6...

REM Create necessary directories
mkdir %USERPROFILE%\.ollama\models 2>nul

REM Install Ollama
echo Installing Ollama...
curl -fsSL https://ollama.ai/install.sh | bash

REM Download exaone-deep:2.4b
echo Downloading exaone-deep:2.4b...
ollama pull exaone-deep:2.4b

REM Download gemma3-1b-Q6
echo Downloading gemma3-1b-Q6...
mkdir temp_download 2>nul
cd temp_download
curl -L -o gemma-3-1b-it-Q6_K.gguf https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q6_K.gguf

REM Create Modelfile for gemma3
echo Creating Modelfile for gemma3...
echo FROM ./gemma-3-1b-it-Q6_K.gguf > Modelfile
echo PARAMETER num_gpu_layers 27 >> Modelfile
echo PARAMETER temperature 0.7 >> Modelfile

REM Create the model in Ollama
echo Creating gemma3 model in Ollama...
ollama create gemma3 -f Modelfile

REM Clean up
cd ..
rmdir /s /q temp_download

echo Setup complete! You can now run:
echo ollama run exaone-deep:2.4b
echo ollama run gemma3
