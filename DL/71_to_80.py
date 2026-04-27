import torch
import matplotlib.pyplot as plt
from transformers import AutoTokenizer, AutoModel

tok = AutoTokenizer.from_pretrained('bert-base-uncased')
m = AutoModel.from_pretrained('bert-base-uncased', output_attentions=True)

text = "The cat sat on the mat ."
x = tok(text, return_tensors='pt')
toks = tok.convert_ids_to_tokens(x['input_ids'][0])

with torch.no_grad():
    out = m(**x)

A = torch.stack(out.attentions).squeeze(1)
H = out.last_hidden_state[0]
L, NH, T, _ = A.shape
print('attention :', A.shape)
print('embeddings:', H.shape)

layer, head = 4, 6
plt.imshow(A[layer, head], cmap='viridis')
plt.xticks(range(T), toks, rotation=90)
plt.yticks(range(T), toks)
plt.title(f'Layer {layer}, Head {head}')
plt.colorbar()
plt.show()


"""
=== UNIVERSAL TRANSFORMER ATTENTION ANALYSIS (Q71–80) ===

This single script covers every variant of "look at attention in a
transformer". Once you have the 4D tensor A (layers × heads × seq × seq)
and the embeddings H (seq × hidden), every question is just a slice or
a small computation on those two tensors.

The two tensors

    A : torch.Tensor of shape (L, NH, T, T)
        L  = number of transformer layers   (BERT-base = 12)
        NH = number of attention heads      (BERT-base = 12)
        T  = number of tokens (incl. [CLS] / [SEP])
        A[l, h, i, j] = how much token i attends to token j in (layer l, head h)

    H : torch.Tensor of shape (T, hidden)
        Final contextual embeddings, one per token.
        BERT-base hidden = 768.

Both come from passing output_attentions=True (or default for hidden states).

------------------------------------------------------------------------
Q71. LOAD MODEL + EXTRACT ATTENTION
------------------------------------------------------------------------
    Already done above. The full recipe:
        AutoModel.from_pretrained('bert-base-uncased', output_attentions=True)
        out = m(**tok(text, return_tensors='pt'))
        A = torch.stack(out.attentions).squeeze(1)
    Print A.shape and you've answered Q71.

------------------------------------------------------------------------
Q72. VISUALIZE ATTENTION HEADS  (all heads of ONE layer)
------------------------------------------------------------------------
    layer = 4
    fig, ax = plt.subplots(3, 4, figsize=(12, 9))
    for h in range(NH):
        ax.flat[h].imshow(A[layer, h], cmap='viridis')
        ax.flat[h].set_title(f'head {h}')
        ax.flat[h].axis('off')
    plt.show()

------------------------------------------------------------------------
Q73. PLOT ATTENTION HEATMAPS  (one specific matrix)
------------------------------------------------------------------------
    Already done in the script above with token labels on both axes.
    Change `layer, head = ...` to look at any (l, h) cell.

------------------------------------------------------------------------
Q74. COMPARE ATTENTION ACROSS LAYERS  (one head, all layers)
------------------------------------------------------------------------
    head = 0
    fig, ax = plt.subplots(3, 4, figsize=(12, 9))
    for l in range(L):
        ax.flat[l].imshow(A[l, head], cmap='viridis')
        ax.flat[l].set_title(f'layer {l}')
        ax.flat[l].axis('off')
    plt.show()
    # Pattern: early layers attend locally / to [CLS]; deeper layers
    # show more diffuse / semantic patterns.

------------------------------------------------------------------------
Q75. MODIFY INPUT, OBSERVE ATTENTION CHANGES
------------------------------------------------------------------------
    for sentence in ["The cat sat on the mat .",
                     "The dog chased the cat ."]:
        x = tok(sentence, return_tensors='pt')
        with torch.no_grad():
            out = m(**x)
        A = torch.stack(out.attentions).squeeze(1)
        plt.imshow(A[4, 6], cmap='viridis')
        plt.title(sentence)
        plt.show()
    # Same head can light up DIFFERENT tokens for different sentences.

------------------------------------------------------------------------
Q76. ANALYZE MULTI-HEAD ATTENTION OUTPUTS  (aggregate across heads)
------------------------------------------------------------------------
    layer = 4
    head_avg = A[layer].mean(dim=0)        # (T, T) — averaged over heads
    head_max = A[layer].max(dim=0).values  # (T, T) — max over heads
    plt.subplot(1, 2, 1); plt.imshow(head_avg)
    plt.subplot(1, 2, 2); plt.imshow(head_max)
    plt.show()
    # Average view = the "consensus" attention pattern of that layer.
    # Max view    = "any head fired here" — wider activation map.

------------------------------------------------------------------------
Q77. VISUALIZE SELF-ATTENTION IN SENTENCES  (with token labels)
------------------------------------------------------------------------
    Already done in the script — the xticks/yticks plus token strings
    is what makes this "self-attention IN A SENTENCE" rather than a
    bare matrix.
    For more readability: plt.figure(figsize=(8, 6))

------------------------------------------------------------------------
Q78. COMPARE ATTENTION PATTERNS FOR DIFFERENT INPUTS
------------------------------------------------------------------------
    Same as Q75 — loop sentences, compare side by side.

------------------------------------------------------------------------
Q79. INTERPRET ATTENTION MATRICES
------------------------------------------------------------------------
    Just plot a meaningful (layer, head) pair and READ the heatmap:
        - Diagonal stripe          → token attends to itself.
        - "Looks at [SEP]" column  → "no-op" head; common in BERT.
        - Looks at next/prev token → positional / syntactic head.
        - Verb→subject column      → syntactic dependency head.
        - Pronoun→referent         → coreference head.
    Pick a head with structure (e.g. layer 4, head 6) — or scan with
    Q72/Q74 to find one.

------------------------------------------------------------------------
Q80. STUDY CONTEXTUAL EMBEDDINGS USING ATTENTION
------------------------------------------------------------------------
    H = out.last_hidden_state[0]                   # (T, 768)
    # Cosine similarity between every pair of token embeddings:
    Hn = H / H.norm(dim=-1, keepdim=True)
    sim = Hn @ Hn.T                                 # (T, T)
    plt.imshow(sim, cmap='coolwarm')
    plt.xticks(range(T), toks, rotation=90)
    plt.yticks(range(T), toks)
    plt.colorbar()
    plt.show()
    # Tokens with similar context have high similarity.
    # Compare side-by-side with attention to see how attention
    # SHAPES the contextual embeddings: tokens that attend to each
    # other end up with similar embeddings in deeper layers.
    #
    # Or compare embeddings of the SAME word across sentences:
    #   "The bank by the river" vs "The bank gave me a loan"
    #   The 'bank' token has different H[3] vectors → contextual.

------------------------------------------------------------------------
COMMON ATTENTION PATTERNS YOU'LL SEE (vocabulary for interpretation)
------------------------------------------------------------------------
  Diagonal           : token attends to itself.
  [CLS] column       : tokens attend to [CLS] (especially deep layers).
  [SEP] column       : "null" / no-op attention. Very common.
  Previous-token     : attention falls one row to the left of diagonal.
  Next-token         : one row to the right.
  Word-piece bridge  : ##suffix attends back to the word's first piece.
  Syntactic (verb→subj, det→noun) : found in middle layers.
  Coref / semantic   : found in deeper layers (last 2-3).
  Uniform            : usually broken / dead head.

------------------------------------------------------------------------
TOOLING (instead of writing matplotlib by hand)
------------------------------------------------------------------------
  - bertviz : interactive HTML visualization of attention.
        from bertviz import head_view, model_view
        head_view(out.attentions, toks)         # all heads, all layers
        model_view(out.attentions, toks)        # zoomable model-wide view
    Pip install:   pip install bertviz

  - exBERT (web tool) : explore attention + embeddings in a browser.

------------------------------------------------------------------------
THE THREE LINES THAT POWER ALL OF THIS
------------------------------------------------------------------------
    AutoModel.from_pretrained('bert-base-uncased', output_attentions=True)
    out = model(**inputs)
    A = torch.stack(out.attentions).squeeze(1)   # (L, NH, T, T)

  Once you have A, every analysis is just a slice or a numpy operation.
  Memorize this trio and you can answer any "attention" question on
  any HuggingFace transformer (BERT, RoBERTa, DistilBERT, GPT-2, etc).

=== Code notes ===

torch.stack(out.attentions).squeeze(1)
  - out.attentions is a TUPLE of L tensors, each of shape
    (batch, NH, T, T).
  - torch.stack(...) along dim 0 → (L, batch, NH, T, T).
  - .squeeze(1) drops the batch dim (we have batch=1) → (L, NH, T, T).

x = tok(text, return_tensors='pt')
  - return_tensors='pt' gives PyTorch tensors. Use 'tf' for TensorFlow.
  - The result is a dict with input_ids, attention_mask, token_type_ids.

toks = tok.convert_ids_to_tokens(x['input_ids'][0])
  - Returns the actual subword strings — including [CLS] and [SEP] —
    aligned with the columns/rows of A and H.

with torch.no_grad():
  - Skips gradient computation. Faster and uses less memory for
    inference-only use.

Switching models (drop-in)
  - 'bert-base-uncased'        : standard, 12 layers × 12 heads.
  - 'distilbert-base-uncased'  : 6 layers × 12 heads — faster.
  - 'roberta-base'             : same shape as BERT, different training.
  - 'gpt2'                     : decoder-only, has CAUSAL mask
                                  (lower-triangular attention).
  - 'sentence-transformers/all-MiniLM-L6-v2' : tiny (6 layers × 12 heads).
  Whatever model you load, the (L, NH, T, T) extraction is identical.
"""
