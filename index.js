const express=require('express')
require('dotenv').config()
const app=express()
const cors=require('cors')
var jwt = require('jsonwebtoken');
const port=process.env.PORT||5000

app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion } = require('mongodb');
const { decode } = require('jsonwebtoken');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1iv6g.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// client.connect(err => {
//   const collection = client.db("test").collection("devices");
//   // perform actions on the collection object
//   client.close();
// });

function verifyJWT(req,res,next){
    const authorization=req.headers.authorization
    // console.log(authorization);
    if(!authorization){
        return res.status(401).send({message:"Unauthorized access"})
    }
    const token=authorization.split(' ')[1]
    jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
        if(err){
            return res.status(403).send({message:"Not allow to access"})
        }
        req.decoded=decoded
        next()
    })
}

async function run(){
    try{
        await client.connect();
        const servicesCollection = client.db("doctors_portal").collection("services");
        const bookingCollection = client.db("doctors_portal").collection("booking");
        const userCollection = client.db("doctors_portal").collection("users");

        app.get('/services',async(req,res)=>{
            const query={}
            const data=req.query
            const cursor = servicesCollection.find(data);
            const result=await cursor.toArray()
            // console.log(result);
            res.send(result)
        })

        app.get('/user',verifyJWT,async(req,res)=>{
            const users=await userCollection.find().toArray()
            res.send(users)
        })

        app.get('/useadmin/:email',async(req,res)=>{
            const email=req.params.email;
            const user=await userCollection.findOne({email:email});
            const isAdmin=user.role==='admin';
            res.send({admin:isAdmin});
        })

        app.put('/user/admin/:email',verifyJWT,async(req,res)=>{
            const email=req.params.email

            const requester=req.decoded.email
            const requestAccount=await userCollection.findOne({email:requester})
            if (requestAccount.role==='admin'){
                const filter={email:email}
                const updateDoc = {
                    $set:{role:'admin'},
                  };
                  const result = await userCollection.updateOne(filter, updateDoc);
                //   console.log(result);
               return   res.send(result)
            }
            else{
            return    res.status(403).send({message:"Forbiden Access"})
            }
         
        })

        app.put('/user/:email',async(req,res)=>{
            const email=req.params.email
            const user=req.body
            const filter={email:email}
            const options = { upsert: true };
            const updateDoc = {
                $set:user,
              };
              const result = await userCollection.updateOne(filter, updateDoc, options);

              const token= jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
            //   console.log(result);
              res.send({result,accessToken:token})
        })

        app.get('/available',async(req,res)=>{
           const services=await servicesCollection.find().toArray();
           const query={date:req.query.date};
           const bookings=await bookingCollection.find(query).toArray();
        //    console.log(services,bookings);
           services.forEach(service=>{
               const serviceBookings= bookings.filter(book=>book.treatment===service.name);
               const bookSlots=serviceBookings.map(item=>item.slot);
               const availableSlots=service.slots.filter(slot=>!bookSlots.includes(slot));
               service.slots=availableSlots;
            //    console.log(service.slots.length,bookSlots.length,serviceBookings);
           })
           res.send(services)
        })

        app.post('/booking',async(req,res)=>{
            const newBooking=req.body
            const query = { treatment: newBooking.treatment, date: newBooking.date, patient: newBooking.patient }
            const exist=await bookingCollection.findOne(query)
            if(exist){
                return res.send({ success: false, booking: exist})
            }
            const result=await bookingCollection.insertOne(newBooking)
            return res.send({ success: true, result });
        })
        
        // myappointment
        app.get('/mybooking',verifyJWT,async(req,res)=>{
           const patient=req.query.patient
        //    console.log(patient);
        // const authorization=req.headers.authorization
        // console.log(authorization);
        const decodedEmail=req.decoded.email
        if(patient===decodedEmail){
            const query={patient:patient};
            const bookings=await bookingCollection.find(query).toArray();
           return res.send(bookings)
        }else{

            return res.status(403).send({message:"Not allow to access"})
        }
           
        })

    }
    finally{
        // await client.close();
    }
}
run().catch(console.dir);
app.get('/',(req,res)=>{
    res.send('CURD is Start')
})
app.listen(port,()=>{console.log('CURD is running',port)})