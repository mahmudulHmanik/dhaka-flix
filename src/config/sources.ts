export type DhakaFlixSource = {
  id: string;
  name: string;
  url: string;
  category: string;
};

export const DHAKAFLIX_SOURCES: DhakaFlixSource[] = [
  { id: "english", name: "English Movies", url: "http://172.16.50.7/DHAKA-FLIX-7/English%20Movies/", category: "English" },
  { id: "english-1080p", name: "English Movies 1080p", url: "http://172.16.50.14/DHAKA-FLIX-14/English%20Movies%20%281080p%29/", category: "English" },
  { id: "hindi", name: "Hindi Movies", url: "http://172.16.50.14/DHAKA-FLIX-14/Hindi%20Movies/", category: "Hindi" },
  { id: "south-indian", name: "South Indian Movies", url: "http://172.16.50.14/DHAKA-FLIX-14/SOUTH%20INDIAN%20MOVIES/South%20Movies/", category: "South Indian" },
  { id: "south-hindi-dubbed", name: "South Hindi Dubbed", url: "http://172.16.50.14/DHAKA-FLIX-14/SOUTH%20INDIAN%20MOVIES/Hindi%20Dubbed/", category: "Hindi" },
  { id: "kolkata-bangla", name: "Kolkata Bangla Movies", url: "http://172.16.50.7/DHAKA-FLIX-7/Kolkata%20Bangla%20Movies/", category: "Bangla" },
  { id: "animation", name: "Animation Movies", url: "http://172.16.50.14/DHAKA-FLIX-14/Animation%20Movies/", category: "Animation" },
  { id: "animation-1080p", name: "Animation 1080p", url: "http://172.16.50.14/DHAKA-FLIX-14/Animation%20Movies%20%281080p%29/", category: "Animation" },
  { id: "foreign", name: "Foreign Language", url: "http://172.16.50.7/DHAKA-FLIX-7/Foreign%20Language%20Movies/", category: "Foreign" },
  { id: "imdb-top-250", name: "IMDb Top 250", url: "http://172.16.50.14/DHAKA-FLIX-14/IMDb%20Top-250%20Movies/", category: "IMDb Top 250" },
  { id: "3d", name: "3D Movies", url: "http://172.16.50.7/DHAKA-FLIX-7/3D%20Movies/", category: "3D" },
  { id: "tv-web", name: "TV & Web Series", url: "http://172.16.50.12/DHAKA-FLIX-12/TV-WEB-Series/", category: "Series" },
  { id: "korean", name: "Korean Series", url: "http://172.16.50.14/DHAKA-FLIX-14/KOREAN%20TV%20%26%20WEB%20Series/", category: "Korean" },
  { id: "cartoon-anime", name: "Cartoon & Anime", url: "http://172.16.50.10/DHAKA-FLIX-10/Anime%20%26%20Cartoon%20TV%20Series/", category: "Anime" },
  { id: "documentary", name: "Documentary", url: "http://172.16.50.10/DHAKA-FLIX-10/Documentary/", category: "Documentary" }
];
