const config = require('config');
const axios = require('axios');
const polyline = require('@mapbox/polyline');
const cors = require('cors');
const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

app.set('view engine', 'pug');
app.set('views','./views');


/* m-utility functions */
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static('public'));
app.use(cors({origin:'http://127.0.0.1:3031'}));


/* webview endpoint: http://localhost:3031/kampala/routes */
app.get('/kampala/routes', (req, res)=>{
    res.status(200).render('navigate',{});
});


/* supply api key */
app.get('/security/api/key', (req,res)=>{
    res.status(200).json({apikey:`${config.get('apikey')}`});
});


/* Starting with 1/2 a minute which is 30,000ms (2 readings per minute) */
setInterval( async () => {
        try{
                const apiResult = await axios.post('https://routes.googleapis.com/directions/v2:computeRoutes?', {
                    origin: {
                        location: { 
                            latLng: {
                                latitude: 0.31361, /* Victoria University */
                                longitude: 32.58917
                            }
                        }
                    }, 
                    destination: {
                        location: { 
                            latLng: {
                                        latitude: 0.3473546684837913, /* Protea Hotel */
                                        longitude: 32.603774070739746
                                    }
                        }
                    },         
                    travelMode: "DRIVE",
                    extraComputations: ["TRAFFIC_ON_POLYLINE"],
                    routingPreference: "TRAFFIC_AWARE_OPTIMAL",
                    computeAlternativeRoutes: true}, 
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Goog-Api-Key': `${config.get('apikey')}`,
                            'X-Goog-FieldMask':'routes.duration,routes.distanceMeters,routes.polyline,routes.legs.polyline,routes.travelAdvisory,routes.legs.travelAdvisory'
                        }
                    }
                );

                const routes = apiResult.data.routes;

                /* Establish database connection */
                const pool = mysql.createPool({
                    host: config.get('host'),
                    port: config.get('port'),
                    database: config.get('database'),
                    user: config.get('username'),
                    password: config.get('password'),
                    waitForConnections: true,
                    connectionLimit: 10,
                    queueLimit: 0
                });

                routes.forEach( async(route, index) => {

                    /* Scoring Logic */
                    const decodedPolyline = polyline.decode(route.polyline.encodedPolyline);
                    let congestionScore = 0;

                    route.legs.forEach(leg => {
                        const intervals = leg.travelAdvisory?.speedReadingIntervals || [];
                        intervals.forEach(interval => {
                            switch(interval.speed){
                                case 'TRAFFIC_JAM': 
                                    congestionScore += 4; 
                                    break;
                                case 'SLOW': 
                                    congestionScore += 3; 
                                    break;
                                case 'MODERATE': 
                                    congestionScore += 2; 
                                    break;
                                case 'NORMAL': 
                                    congestionScore += 1; 
                                    break;
                                default: break;
                            }
                        });
                    }); 

                    /* Database insertion Point */
                    const [rows, fields] = await pool.execute(
                        `INSERT INTO route_snapshots (route_index, duration_seconds, distance_meters, congestion_score, polyline)
                        VALUES (?, ?, ?, ?, ?)`,
                        [
                            index,
                            parseInt(route.duration.replace('s', '')),
                            route.distanceMeters,
                            congestionScore,
                            route.polyline.encodedPolyline
                        ]
                    );

                    console.log(`Route ${ index + 1 } inserted into DB.`);

                    /* Results of the identified routes. */
                    console.log(`- Route ${index + 1}:`);
                    console.log(`- Duration: ${route.duration}`);
                    console.log(`- Distance: ${route.distanceMeters}m`);
                    console.log(`- Congestion Score: ${congestionScore}`);
                    console.log(`- First 3 polyline coords:`, decodedPolyline.slice(0, 3));

                });
        } catch(error){
               console.error("Error fetching traffic data:", error);
        }
    }, 30000);



/* logs traffic data between victoria university & Protea hotel at a 5 Mins interval. */
app.get('/direction', async (req, res) => {
    try{
//         const apiResult = await axios.post('https://routes.googleapis.com/directions/v2:computeRoutes?', {
//             origin: {location: { latLng: {latitude: 0.347596,longitude: 32.582520}}},
//             destination: {
//             location: { latLng: {latitude: 0.3145,longitude: 32.5800}}},
//             travelMode: "DRIVE",
//             extraComputations: ["TRAFFIC_ON_POLYLINE"],
//             routingPreference: "TRAFFIC_AWARE_OPTIMAL",
//             computeAlternativeRoutes: true}, {
//             headers: {
//                 'Content-Type': 'application/json','X-Goog-Api-Key': `${config.get('apikey')}`,
//                 'X-Goog-FieldMask':'routes.duration,routes.distanceMeters,routes.polyline,routes.legs.polyline,routes.travelAdvisory,routes.legs.travelAdvisory'
//             }});
//         //console.log(apiResult.data);
//         res.status(200).json(apiResult.data);
        res.status(200).json({message:'Traffic conjestion data logging in progress...'});
    } catch(error){
        console.log(error);
        res.status(500).send(`ServerError: ${error.message}`);
    }
});



/* service port channel */
const port = process.env.PORT || 3031;
app.listen(port, ()=> console.log(`Server listening on port ${ port }!!`));