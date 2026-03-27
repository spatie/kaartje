import { createContext, useCallback, useContext, useRef } from "react";

export interface Photo {
  path: string;
  width: number;
  height: number;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
}

interface PostcardState {
  frontPhoto: Photo | null;
  croppedPhoto: Photo | null;
  message: string;
  senderName: string;
  location: UserLocation | null;
  country: string;
  hasGps: boolean;
  setFrontPhoto: (photo: Photo) => void;
  setCroppedPhoto: (photo: Photo) => void;
  setMessage: (msg: string) => void;
  setSenderName: (name: string) => void;
  setLocation: (loc: UserLocation | null) => void;
  setCountry: (country: string) => void;
  setHasGps: (has: boolean) => void;
  reset: () => void;
}

const PostcardContext = createContext<PostcardState | null>(null);

export function PostcardProvider({ children }: { children: React.ReactNode }) {
  const frontPhoto = useRef<Photo | null>(null);
  const croppedPhoto = useRef<Photo | null>(null);
  const message = useRef("");
  const senderName = useRef("");
  const location = useRef<UserLocation | null>(null);
  const country = useRef("");
  const hasGps = useRef(false);

  const setFrontPhoto = useCallback((photo: Photo) => {
    frontPhoto.current = photo;
  }, []);

  const setCroppedPhoto = useCallback((photo: Photo) => {
    croppedPhoto.current = photo;
  }, []);

  const setMessage = useCallback((msg: string) => {
    message.current = msg;
  }, []);

  const setSenderName = useCallback((name: string) => {
    senderName.current = name;
  }, []);

  const setLocation = useCallback((loc: UserLocation | null) => {
    location.current = loc;
  }, []);

  const setCountry = useCallback((c: string) => {
    country.current = c;
  }, []);

  const setHasGps = useCallback((has: boolean) => {
    hasGps.current = has;
  }, []);

  const reset = useCallback(() => {
    frontPhoto.current = null;
    croppedPhoto.current = null;
    message.current = "";
    senderName.current = "";
    // Keep location/country across sessions — it doesn't change often
  }, []);

  return (
    <PostcardContext.Provider
      value={{
        get frontPhoto() {
          return frontPhoto.current;
        },
        get croppedPhoto() {
          return croppedPhoto.current;
        },
        get message() {
          return message.current;
        },
        get senderName() {
          return senderName.current;
        },
        get location() {
          return location.current;
        },
        get country() {
          return country.current;
        },
        get hasGps() {
          return hasGps.current;
        },
        setFrontPhoto,
        setCroppedPhoto,
        setMessage,
        setSenderName,
        setLocation,
        setCountry,
        setHasGps,
        reset,
      }}
    >
      {children}
    </PostcardContext.Provider>
  );
}

export function usePostcard() {
  const ctx = useContext(PostcardContext);
  if (!ctx) throw new Error("usePostcard must be used within PostcardProvider");
  return ctx;
}
