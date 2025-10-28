ALTER TABLE public.vapi_calls
ADD CONSTRAINT fk_vapi_calls_assistant
FOREIGN KEY (assistant_id)
REFERENCES public.vapi_assistants (assistant_id)
ON DELETE SET NULL; 