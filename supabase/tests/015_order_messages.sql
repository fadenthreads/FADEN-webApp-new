begin;
select plan(12);
select ok((select relrowsecurity from pg_class where oid='public.order_messages'::regclass),'messages RLS');
select ok((select relrowsecurity from pg_class where oid='public.order_message_reads'::regclass),'read cursors RLS');
select ok(not has_table_privilege('anon','public.order_messages','SELECT'),'anonymous history denied');
select ok(not has_table_privilege('authenticated','public.order_messages','INSERT'),'direct send denied');
select ok(not has_table_privilege('authenticated','public.order_messages','DELETE'),'history immutable');
select ok(not has_table_privilege('authenticated','public.order_message_reads','UPDATE'),'direct read cursor writes denied');
select ok(not has_function_privilege('anon','public.send_order_message(uuid,text,uuid)','EXECUTE'),'anonymous sends denied');
select ok(not has_function_privilege('anon','public.mark_order_messages_read(uuid,integer)','EXECUTE'),'anonymous read marking denied');
select ok(
  exists(
    select 1
    from pg_trigger
    where tgrelid = 'public.order_messages'::regclass
      and tgname = 'order_message_notification'
      and not tgisinternal
  ),
  'new messages queue an email notification'
);
select ok(
  not has_function_privilege('anon','public.enqueue_order_message_notification()','EXECUTE'),
  'anonymous users cannot invoke the notification trigger function'
);
select ok(
  not has_function_privilege('authenticated','public.enqueue_order_message_notification()','EXECUTE'),
  'authenticated users cannot invoke the notification trigger function directly'
);
select ok(
  position('new.body' in lower(pg_get_functiondef('public.enqueue_order_message_notification()'::regprocedure))) = 0,
  'notification payload never contains the private message body'
);
select * from finish();rollback;
