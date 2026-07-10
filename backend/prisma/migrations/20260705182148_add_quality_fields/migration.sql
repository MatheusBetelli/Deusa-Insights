-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "confiancaVerificacao" INTEGER,
ADD COLUMN     "dataVerificacaoGeo" TIMESTAMP(3),
ADD COLUMN     "enderecoCompleto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enderecoVerificado" TEXT,
ADD COLUMN     "fonteGeocodificacao" TEXT,
ADD COLUMN     "latitudeVerificada" DOUBLE PRECISION,
ADD COLUMN     "longitudeVerificada" DOUBLE PRECISION,
ADD COLUMN     "motivoPontuacao" JSONB,
ADD COLUMN     "motivosPendencia" JSONB,
ADD COLUMN     "nivelOportunidade" TEXT,
ADD COLUMN     "origemCoordenada" TEXT,
ADD COLUMN     "pendenteValidacao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pontuacaoOportunidade" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "statusVerificacaoEndereco" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "pendenteValidacao" BOOLEAN NOT NULL DEFAULT false;
