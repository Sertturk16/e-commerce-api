BEGIN TRAN;

-- Drop the unique constraint on user_id (which doesn't allow multiple NULLs in SQL Server)
ALTER TABLE [dbo].[Cart] DROP CONSTRAINT [Cart_user_id_key];

-- Create a filtered unique index that only applies to non-NULL user_id values
-- This allows multiple anonymous carts (user_id=NULL) while ensuring one cart per authenticated user
CREATE UNIQUE NONCLUSTERED INDEX [Cart_user_id_key] ON [dbo].[Cart]([user_id]) WHERE [user_id] IS NOT NULL;

COMMIT TRAN;
