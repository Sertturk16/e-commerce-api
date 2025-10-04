BEGIN TRAN;

-- Drop the index on is_active column
DROP INDEX [Product_is_active_idx] ON [dbo].[Product];

-- Drop the default constraint on is_active column
ALTER TABLE [dbo].[Product] DROP CONSTRAINT [Product_is_active_df];

-- Drop the is_active column
ALTER TABLE [dbo].[Product] DROP COLUMN [is_active];

COMMIT TRAN;
