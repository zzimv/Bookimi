-- Доставка: пункт выдачи СДЭК и код города на отправлении, адресная книга покупателя (последние 3 адреса)
ALTER TABLE "Shipment" ADD COLUMN "cityCode" INTEGER,
ADD COLUMN "pvzCode" TEXT,
ADD COLUMN "pvzAddress" TEXT;

ALTER TABLE "User" ADD COLUMN "savedAddresses" JSONB;
