-- Drop unique constraint on user_id
IF EXISTS (SELECT * FROM sys.key_constraints WHERE name = 'Cart_user_id_key' AND parent_object_id = OBJECT_ID('dbo.Cart'))
    ALTER TABLE [dbo].[Cart] DROP CONSTRAINT [Cart_user_id_key];

-- Also drop index if it exists
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'Cart_user_id_key' AND object_id = OBJECT_ID('dbo.Cart'))
    DROP INDEX [Cart_user_id_key] ON [dbo].[Cart];

-- Create non-unique index for user_id for query performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'Cart_user_id_idx' AND object_id = OBJECT_ID('dbo.Cart'))
    CREATE INDEX [Cart_user_id_idx] ON [dbo].[Cart]([user_id]) WHERE [user_id] IS NOT NULL;
