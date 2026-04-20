ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS text_ciphertext text,
  ADD COLUMN IF NOT EXISTS text_iv text,
  ADD COLUMN IF NOT EXISTS text_key_version smallint NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.memories.text_ciphertext IS
  'Encrypted memory body payload (AES-256-GCM ciphertext + auth tag, base64 encoded)';

COMMENT ON COLUMN public.memories.text_iv IS
  'AES-256-GCM IV for encrypted memory body (base64 encoded)';

COMMENT ON COLUMN public.memories.text_key_version IS
  'Server-side memory body encryption key version';
