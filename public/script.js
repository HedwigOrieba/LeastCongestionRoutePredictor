// Initialize and add the map
 let map;

 let location_latitude;
 let location_longitude;

 /* Cleint Geo-coordinate Locator custom function */
const geolocator = ()=>{
    return new Promise((resolve,reject)=>{
        if("geolocation" in navigator){
            navigator.geolocation.watchPosition(
                /* Position callback */
                (position)=>{
                    location_latitude = position.coords.latitude;
                    location_longitude = position.coords.longitude;
                    resolve({ latitude:position.coords.latitude, longitude:position.coords.longitude });
                },(error)=>{
                    reject({message:"Error retrieving location"});
                })
            }else{
                reject({message:"Geo_Location API not supported by this browser."});
            }
        });
    };


async function initMap() {
    try{
            const userlocation = await geolocator();
            const origin  = `${userlocation.latitude}, ${userlocation.longitude}`;
            console.log('Source --->',userlocation.latitude, userlocation.longitude);

            /* Dynamically detected user coordinates. */
            const position = { lat: userlocation.latitude, lng: userlocation.longitude };

            /* Request needed libraries. */
            const { Map, TrafficLayer }     = await google.maps.importLibrary("maps");
            const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

            /* The map, centered at Kampala */
            map = new Map(document.getElementById("map"), {
                zoom: 15,
                center: position,
                mapId: "DEMO_MAP_ID",
            });


            /* activate traffic-layer dynamically */
            const trafficLayer = new TrafficLayer();

            // Adds live traffic overlay
            trafficLayer.setMap(map); 


            /* location marker */
            const marker = new AdvancedMarkerElement({
                map: map,
                position: position,
                title: "You are here"
            });

            /* Adding a click event listener. Internally invokes a progress of action route from the backend. */
            google.maps.event.addListener(map,'click', async(event) => {
                const destination = `${event.latLng.lat()}, ${event.latLng.lng()}`; 
                console.log('Destination --->',destination);
                alert(`Traffic data collection initiated for source coords: [${origin}] and destination coords: [${destination}]`);
                const result = await fetch(`http://localhost:3031/direction`);
                console.log("Server_Response: ", result);
            });

    }catch(error){
        console.log("MyError", error);
    }
}

initMap();