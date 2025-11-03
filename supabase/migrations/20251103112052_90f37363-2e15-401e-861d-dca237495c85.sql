-- Enable realtime for delivery tracking tables
ALTER TABLE delivery_batches REPLICA IDENTITY FULL;
ALTER TABLE batch_stops REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE delivery_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE batch_stops;