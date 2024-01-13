# Weed Map
This is the repository to a small js website powered by
- [Leaflet](https://leafletjs.com/) for map rendering,
- [OpenStreetMap](https://www.openstreetmap.org/) for map data,
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) to query the map data
- [Turf.js](https://turfjs.org/) for geospatial analysis (buffer creation)
- [remixicon](https://remixicon.com/) for icons

It shows the location on where public consumption of cannabis will be tolerated in Germany.
This attempts to be in accordance with the newly proposed law found [here](https://dserver.bundestag.de/btd/20/087/2008704.pdf).

The main point visualized here are the restrictions put in place by *§5 Konsumverbot (2) Paragraph* of the proposed law:

> # §5 Konsumverbot
> (1) Der Konsum von Cannabis in unmittelbarer Gegenwart von Personen, die das 18. Lebensjahr noch nicht
> vollendet haben, ist verboten.
> 
> (2) Der öffentliche Konsum von Cannabis ist verboten:
> 1. in Schulen und in einem Bereich von 200 Metern um den Eingangsbereich von Schulen,
> 2. auf Kinderspielplätzen und in einem Bereich von 200 Metern um den Eingangsbereich von Kinderspielplätzen,
> 3. in Kinder- und Jugendeinrichtungen und in einem Bereich von 200 Metern um den Eingangsbereich von Kinder- und Jugendeinrichtungen,
> 4. in öffentlich zugänglichen Sportstätten,
> 5. in Fußgängerzonen zwischen 7 und 20 Uhr und
> 6. innerhalb des befriedeten Besitztums von Anbauvereinigungen und in einem Bereich von 200 Metern um den Eingangsbereich von Anbauvereinigungen.
> 
> (3) In militärischen Bereichen der Bundeswehr ist der Konsum von Cannabis verboten.
