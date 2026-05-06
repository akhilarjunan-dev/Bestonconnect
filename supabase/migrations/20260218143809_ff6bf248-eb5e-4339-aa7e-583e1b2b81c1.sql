ALTER TABLE products
  ADD COLUMN available_from time without time zone,
  ADD COLUMN available_to time without time zone;