BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [salt] NVARCHAR(1000) NOT NULL,
    [hash] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'CUSTOMER',
    [phone] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [User_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Product] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [price] FLOAT(53) NOT NULL,
    [stock] INT NOT NULL CONSTRAINT [Product_stock_df] DEFAULT 0,
    [category] NVARCHAR(1000) NOT NULL,
    [seller_id] NVARCHAR(1000) NOT NULL,
    [images] NVARCHAR(1000),
    [variants] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [Product_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [Product_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Cart] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000),
    [session_id] NVARCHAR(1000),
    [expires_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [Cart_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [Cart_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Cart_user_id_key] UNIQUE NONCLUSTERED ([user_id]),
    CONSTRAINT [Cart_session_id_key] UNIQUE NONCLUSTERED ([session_id])
);

-- CreateTable
CREATE TABLE [dbo].[CartItem] (
    [id] NVARCHAR(1000) NOT NULL,
    [cart_id] NVARCHAR(1000) NOT NULL,
    [product_id] NVARCHAR(1000) NOT NULL,
    [quantity] INT NOT NULL,
    [reservation_expires_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [CartItem_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [CartItem_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CartItem_cart_id_product_id_key] UNIQUE NONCLUSTERED ([cart_id],[product_id])
);

-- CreateTable
CREATE TABLE [dbo].[Order] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [address_id] NVARCHAR(1000),
    [parent_order_id] NVARCHAR(1000),
    [seller_id] NVARCHAR(1000),
    [total_amount] FLOAT(53) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Order_status_df] DEFAULT 'PENDING',
    [payment_method] NVARCHAR(1000),
    [payment_status] NVARCHAR(1000) NOT NULL CONSTRAINT [Order_payment_status_df] DEFAULT 'PENDING',
    [shipping_address] NVARCHAR(1000) NOT NULL,
    [is_parent] BIT NOT NULL CONSTRAINT [Order_is_parent_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [Order_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [Order_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[OrderItem] (
    [id] NVARCHAR(1000) NOT NULL,
    [order_id] NVARCHAR(1000) NOT NULL,
    [product_id] NVARCHAR(1000) NOT NULL,
    [seller_id] NVARCHAR(1000) NOT NULL,
    [quantity] INT NOT NULL,
    [price] FLOAT(53) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [OrderItem_status_df] DEFAULT 'PENDING',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [OrderItem_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [OrderItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Favorite] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [product_id] NVARCHAR(1000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [Favorite_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Favorite_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Favorite_user_id_product_id_key] UNIQUE NONCLUSTERED ([user_id],[product_id])
);

-- CreateTable
CREATE TABLE [dbo].[Address] (
    [id] NVARCHAR(1000) NOT NULL,
    [user_id] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [full_name] NVARCHAR(1000) NOT NULL,
    [phone] NVARCHAR(1000) NOT NULL,
    [country] NVARCHAR(1000) NOT NULL,
    [city] NVARCHAR(1000) NOT NULL,
    [district] NVARCHAR(1000),
    [postal_code] NVARCHAR(1000) NOT NULL,
    [address_line] NVARCHAR(1000) NOT NULL,
    [is_default] BIT NOT NULL CONSTRAINT [Address_is_default_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [Address_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [Address_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_category_idx] ON [dbo].[Product]([category]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Product_seller_id_idx] ON [dbo].[Product]([seller_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Cart_expires_at_idx] ON [dbo].[Cart]([expires_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CartItem_product_id_idx] ON [dbo].[CartItem]([product_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CartItem_reservation_expires_at_idx] ON [dbo].[CartItem]([reservation_expires_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_user_id_idx] ON [dbo].[Order]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_address_id_idx] ON [dbo].[Order]([address_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_parent_order_id_idx] ON [dbo].[Order]([parent_order_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_seller_id_idx] ON [dbo].[Order]([seller_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_status_idx] ON [dbo].[Order]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_is_parent_idx] ON [dbo].[Order]([is_parent]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Order_created_at_idx] ON [dbo].[Order]([created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderItem_order_id_idx] ON [dbo].[OrderItem]([order_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderItem_product_id_idx] ON [dbo].[OrderItem]([product_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderItem_seller_id_idx] ON [dbo].[OrderItem]([seller_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OrderItem_status_idx] ON [dbo].[OrderItem]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Favorite_user_id_idx] ON [dbo].[Favorite]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Favorite_product_id_idx] ON [dbo].[Favorite]([product_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Address_user_id_idx] ON [dbo].[Address]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Address_is_default_idx] ON [dbo].[Address]([is_default]);

-- AddForeignKey
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_seller_id_fkey] FOREIGN KEY ([seller_id]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Cart] ADD CONSTRAINT [Cart_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CartItem] ADD CONSTRAINT [CartItem_cart_id_fkey] FOREIGN KEY ([cart_id]) REFERENCES [dbo].[Cart]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CartItem] ADD CONSTRAINT [CartItem_product_id_fkey] FOREIGN KEY ([product_id]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [Order_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [Order_address_id_fkey] FOREIGN KEY ([address_id]) REFERENCES [dbo].[Address]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [Order_parent_order_id_fkey] FOREIGN KEY ([parent_order_id]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderItem] ADD CONSTRAINT [OrderItem_order_id_fkey] FOREIGN KEY ([order_id]) REFERENCES [dbo].[Order]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[OrderItem] ADD CONSTRAINT [OrderItem_product_id_fkey] FOREIGN KEY ([product_id]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderItem] ADD CONSTRAINT [OrderItem_seller_id_fkey] FOREIGN KEY ([seller_id]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Favorite] ADD CONSTRAINT [Favorite_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Favorite] ADD CONSTRAINT [Favorite_product_id_fkey] FOREIGN KEY ([product_id]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Address] ADD CONSTRAINT [Address_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
