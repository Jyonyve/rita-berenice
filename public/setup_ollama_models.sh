#!/bin/bash

echo "Setting up Ollama with exaone-deep:2.4b and gemma3-1b-Q6..."

# Create necessary directories
mkdir -p ~/.ollama/models

# Install Ollama
echo "Installing Ollama..."
curl -fsSL https://ollama.ai/install.sh | sh

# Download exaone-deep:2.4b
echo "Downloading exaone-deep:2.4b..."
ollama pull exaone-deep:2.4b

# Download gemma3-1b-Q6
echo "Downloading gemma3-1b-Q6..."
mkdir -p temp_download
cd temp_download
curl -L -o gemma-3-1b-it-Q6_K.gguf https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q6_K.gguf

# Create Modelfile for gemma3
echo "Creating Modelfile for gemma3..."
cat > Modelfile << EOL
FROM ./gemma-3-1b-it-Q6_K.gguf
PARAMETER num_gpu_layers 27
PARAMETER temperature 0.7
EOL

# Create the model in Ollama
echo "Creating gemma3 model in Ollama..."
ollama create gemma3 -f Modelfile

# Clean up
cd ..
rm -rf temp_download

echo "Setup complete! You can now run:"
echo "ollama run exaone-deep:2.4b"
echo "ollama run gemma3"
