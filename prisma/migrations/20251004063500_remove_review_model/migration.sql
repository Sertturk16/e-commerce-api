BEGIN TRAN;

-- Drop the Review table (this will cascade drop all indexes and constraints)
DROP TABLE [dbo].[Review];

COMMIT TRAN;
