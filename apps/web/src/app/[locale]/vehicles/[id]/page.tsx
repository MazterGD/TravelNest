import VehicleDetailsPageContent from "./VehicleDetailsPageContent";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function VehicleDetailsPage({ params }: PageProps) {
  const { locale, id } = await params;
  return <VehicleDetailsPageContent locale={locale} vehicleId={id} />;
}
