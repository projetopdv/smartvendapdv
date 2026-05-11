ALTER TABLE public.sale_items DROP CONSTRAINT sale_items_product_id_fkey;
ALTER TABLE public.sale_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.table_order_items DROP CONSTRAINT IF EXISTS table_order_items_product_id_fkey;
ALTER TABLE public.table_order_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.table_order_items ADD CONSTRAINT table_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;