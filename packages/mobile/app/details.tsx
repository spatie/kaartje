import { router } from "expo-router";
import { usePostcard } from "../contexts/PostcardContext";
import { DetailsView } from "../components/DetailsView";

export default function DetailsScreen() {
  const { croppedPhoto, hasGps, setMessage, setSenderName, setCountry } = usePostcard();

  if (!croppedPhoto) {
    router.replace("/camera-front");
    return null;
  }

  return (
    <DetailsView
      showLocationInput={!hasGps}
      onBack={() => router.back()}
      onContinue={(message, senderName, country) => {
        setMessage(message);
        setSenderName(senderName);
        if (country) setCountry(country);
        router.push("/preview");
      }}
    />
  );
}
