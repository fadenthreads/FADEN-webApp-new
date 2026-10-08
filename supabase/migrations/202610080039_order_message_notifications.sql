-- Notify only the other participant that an active-order message exists.
-- The message body is deliberately excluded from the operational outbox.
create or replace function public.enqueue_order_message_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.outbox_events (
    event_type,
    aggregate_type,
    aggregate_id,
    payload
  ) values (
    'order.message_sent',
    'customer_order',
    new.order_id::text,
    jsonb_build_object(
      'order_id', new.order_id,
      'message_id', new.id,
      'sender_id', new.sender_id
    )
  );
  return new;
end;
$$;

revoke all on function public.enqueue_order_message_notification()
from public, anon, authenticated;

drop trigger if exists order_message_notification on public.order_messages;
create trigger order_message_notification
after insert on public.order_messages
for each row execute function public.enqueue_order_message_notification();

comment on function public.enqueue_order_message_notification() is
'Queues an identifier-only email notification for a newly inserted active-order message.';
