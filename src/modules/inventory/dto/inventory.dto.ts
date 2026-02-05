import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsEnum, Min } from 'class-validator';

/**
 * Response DTOs
 */

export class InventoryListResponse {
  @ApiProperty({ description: 'Inventory ID' })
  id: string;

  @ApiProperty({ description: 'Product ID' })
  product_id: string;

  @ApiProperty({ description: 'Product name' })
  product_name: string;

  @ApiProperty({ description: 'Branch ID' })
  branch_id: string;

  @ApiProperty({ description: 'Available quantity' })
  qty_available: number;

  @ApiProperty({ description: 'Reserved quantity' })
  qty_reserved: number;

  @ApiProperty({ description: 'Total sold quantity' })
  qty_sold: number;

  @ApiProperty({ description: 'Low stock threshold' })
  low_stock_threshold: number;

  @ApiProperty({ description: 'Is low stock' })
  is_low_stock: boolean;

  @ApiPropertyOptional({ description: 'Total quantity (available + reserved)' })
  total_quantity?: number;

  @ApiPropertyOptional({ description: 'Product image URL' })
  image_url?: string;

  @ApiPropertyOptional({ description: 'Product category' })
  category?: string;

  @ApiProperty({ description: 'Created at' })
  created_at: string;

  @ApiProperty({ description: 'Updated at' })
  updated_at: string;
}

export class InventoryAlertResponse {
  @ApiProperty({ description: 'Product ID' })
  product_id: string;

  @ApiProperty({ description: 'Product name' })
  product_name: string;

  @ApiProperty({ description: 'Branch ID' })
  branch_id: string;

  @ApiProperty({ description: 'Branch name' })
  branch_name: string;

  @ApiProperty({ description: 'Available quantity' })
  qty_available: number;

  @ApiProperty({ description: 'Low stock threshold' })
  low_stock_threshold: number;

  @ApiPropertyOptional({ description: 'Product image URL' })
  image_url?: string;
}

export class InventoryLogResponse {
  @ApiProperty({ description: 'Log ID' })
  id: string;

  @ApiProperty({ description: 'Product ID' })
  product_id: string;

  @ApiProperty({ description: 'Branch ID' })
  branch_id: string;

  @ApiProperty({ description: 'Transaction type' })
  transaction_type: string;

  @ApiProperty({ description: 'Quantity change' })
  qty_change: number;

  @ApiProperty({ description: 'Quantity before change' })
  qty_before: number;

  @ApiProperty({ description: 'Quantity after change' })
  qty_after: number;

  @ApiPropertyOptional({ description: 'Reference ID (e.g., order_id)' })
  reference_id?: string;

  @ApiPropertyOptional({ description: 'Reference type (e.g., ORDER)' })
  reference_type?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  notes?: string;

  @ApiPropertyOptional({ description: 'Created by user ID' })
  created_by?: string;

  @ApiProperty({ description: 'Created at' })
  created_at: string;
}

export class InventoryDetailResponse extends InventoryListResponse {
  @ApiPropertyOptional({ description: 'Product details' })
  product?: {
    id: string;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    category?: string;
  };
}

/**
 * Request DTOs
 */

export class UpdateInventoryRequest {
  @ApiPropertyOptional({ description: 'Available quantity', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  qty_available?: number;

  @ApiPropertyOptional({ description: 'Low stock threshold', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  low_stock_threshold?: number;
}

export enum TransactionType {
  RESTOCK = 'RESTOCK',
  SALE = 'SALE',
  RESERVE = 'RESERVE',
  RELEASE = 'RELEASE',
  ADJUSTMENT = 'ADJUSTMENT',
  DAMAGE = 'DAMAGE',
  RETURN = 'RETURN',
}

export class AdjustInventoryRequest {
  @ApiProperty({ description: 'Quantity change (positive or negative)' })
  @IsNumber()
  qty_change: number;

  @ApiProperty({
    description: 'Transaction type',
    enum: TransactionType,
    example: TransactionType.ADJUSTMENT
  })
  @IsEnum(TransactionType)
  transaction_type: TransactionType;

  @ApiPropertyOptional({ description: 'Notes for the adjustment' })
  @IsOptional()
  @IsString()
  notes?: string;
}
