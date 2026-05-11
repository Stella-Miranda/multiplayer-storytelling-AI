import sys
import os
import warnings
import logging

from huggingface_hub import hf_hub_download
from llama_cpp import Llama

warnings.filterwarnings("ignore")
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)

# =========================
# LOAD MODELS
# =========================

phi_path = hf_hub_download(
    repo_id="unsloth/Phi-4-mini-instruct-GGUF",
    filename="Phi-4-mini-instruct-Q4_K_M.gguf",
    local_dir="."
)

llama_path = hf_hub_download(
    repo_id="MaziyarPanahi/Llama-3-8B-Instruct-v0.1-GGUF",
    filename="Llama-3-8B-Instruct-v0.1.Q4_K_M.gguf",
    local_dir="."
)

compressor = Llama(
    model_path=phi_path,
    n_ctx=8192,
    n_threads=4,
    verbose=False
)

brain = Llama(
    model_path=llama_path,
    n_ctx=2048,
    n_threads=4,
    verbose=False
)

# =========================
# RECEIVE PROMPT
# =========================

user_input = sys.stdin.read()

# =========================
# COMPRESS
# =========================

compression_prompt = f"""
<|user|>
Summarize this text into a dense, fact-heavy prompt for another AI:

{user_input}
<|end|>
<|assistant|>
"""

compression_output = compressor(
    compression_prompt,
    max_tokens=512,
    stop=["<|end|>"]
)

compressed_text = compression_output["choices"][0]["text"].strip()

# =========================
# FINAL RESPONSE
# =========================

full_prompt = f"""
<|begin_of_text|>
<|start_header_id|>user<|end_header_id|>

{compressed_text}
<|eot_id|>
<|start_header_id|>assistant<|end_header_id|>
"""

output = brain(
    full_prompt,
    max_tokens=512,
    stop=["<|eot_id|>"]
)

response = output["choices"][0]["text"].strip()

print(response)
