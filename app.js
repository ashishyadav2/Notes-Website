const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const ejs = require("ejs");
const _ = require('lodash');
const app = express();
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const session = require('express-session');
app.use(bodyParser.urlencoded({extended: true}));
dotenv.config();

app.use(session({
    secret : process.env.KEY,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.set("view engine","ejs");
app.use(express.static("public"));
const PORT = process.env.PORT || 3000;
const URI = process.env.URI;
mongoose.set('strictQuery',true);
mongoose.connect(URI);


const noteSchema = new mongoose.Schema({
    title: String,
    content: String
});

const multipleUserSchema = new mongoose.Schema({
    username: String,
    password: String,
    notesList: [noteSchema]
});
multipleUserSchema.plugin(passportLocalMongoose);
// const Note = mongoose.model('NoteItem',noteSchema);
const MultipleUser = mongoose.model('note',multipleUserSchema);
passport.use(MultipleUser.createStrategy());
passport.serializeUser(MultipleUser.serializeUser());
passport.deserializeUser(MultipleUser.deserializeUser());

var currentUser = "";
var errMessage = "";
var className  = "hide";
app.get("/profile/:profileId",(req,res)=>{
    const userProfileId = _.lowerCase(req.params.profileId);
        if(req.isAuthenticated()&&userProfileId===_.lowerCase(currentUser)) {
            MultipleUser.findOne({username: userProfileId},(err,foundNotes)=>{
                if(!err) {
                    let text = "Your notes are empty. Create one by clicking (+) button";
                    if(foundNotes.notesList.length === 0) {
                        res.render("home",{noteListArray: foundNotes.notesList,userProfileId:foundNotes.username,text: text}); 
                    }
                    else {
                        text = "";
                        res.render("home",{noteListArray: foundNotes.notesList,userProfileId:foundNotes.username,text: text}); 
                    }
                }
                else {
                    res.send(err);
                }
            });
        }
        else {
            res.redirect("/login");
        }
    });
app.get("/logout",(req,res,next)=>{
    req.logout((err)=>{
        if(err) {
            console.log(next(err));
        }
        else {
            res.redirect("/");
        }
    });
});
app.post("/profile/:profileId/create",(req,res)=>{
    const noteInfo = {
        _id: "",
        title: "",
        content: ""
    }
    const profileId = req.params.profileId;
    res.render("createNote",{noteInfo: noteInfo,userProfileId:profileId});
});

app.post("/profile/:profileId/post",(req,res)=>{
    const userName = req.params.profileId;
    const noteId = req.body.noteId;
    const title = req.body.noteTitle;
    const content = req.body.noteContent;
    const newNote = {
        title: title,
        content: content
    };
    MultipleUser.findOne({username: userName},(err,foundNotes)=>{
        if(!err) {
            MultipleUser.findOne({notesList : {$elemMatch: {_id: noteId}}},(err,foundNote)=>{
                if(noteId === "") {
                    if(!foundNote) {
                        foundNotes.notesList.push(newNote);
                        foundNotes.save();
                        res.redirect(`/profile/${userName}`);
                    }
                }
                else {
                    MultipleUser.updateOne({"notesList._id" : noteId},{"notesList.$.title": title,"notesList.$.content":content},(err)=>{
                        if(!err) {
                            res.redirect(`/profile/${userName}`);
                        }
                    });
                }
            });
        }
        else {
            console.log(err);
        }
    });
});

app.post("/profile/:profileId/edit",(req,res)=>{
    const editId = req.body.editNoteId;
    const userName = req.params.profileId
    MultipleUser.findOne({notesList : {$elemMatch: {_id: editId}}},{notesList : {$elemMatch: {_id: editId}}},(err,result)=>{
        if(!err) {
            if(result) {
                res.render("createNote",{noteInfo: result.notesList[0],userProfileId:userName});
            }
        }
        else {
            console.log(err);
        }
    });
});

app.post("/profile/:profileId/delete",(req,res)=>{
    const delId = req.body.delNoteId;
    const username = req.params.profileId;
    MultipleUser.findOneAndUpdate({username: username},{$pull: {notesList:{_id:delId}}},(err,foundList)=>{
        if(!err) {
            res.redirect(`/profile/${username}`);
        }
    });
});

app.get("/",(req,res)=>{
    res.render("index");
});

app.get("/logout",(req,res,next)=>{
    req.logout((err)=>{
        if(err) {
            console.log(next(err));
        }
        else {
            res.redirect("/");
        }
    });
});

app.get("/login",(req,res)=>{
    res.render("login");
});

app.post("/login",(req,res)=>{
    const username = _.lowerCase(req.body.username);
    const password = req.body.password;
    currentUser = username;
    const newUser = new MultipleUser({
        username: username,
        password: password
    });
    req.login(newUser,(err)=>{
        if(err) {
            console.log(err);
            errMessage = '<div><h1>Invalid id or password. <a href="/login">Try again</a></h1></div>';
            res.send(errMessage);
        }
        else {
            passport.authenticate("local")(req,res,()=>{
                res.redirect(`/profile/${username}`);
            });
        }
    });
});

app.get("/register",(req,res)=>{
    res.render("register");
});

app.post("/register",(req,res)=>{
    const username = _.lowerCase(req.body.username);
    const password = req.body.password;
    currentUser = username;
    MultipleUser.register({username: username},password,(err,user)=>{
        if(err) {
            console.log(err);
            errMessage = '<div><h1>Username already exists. <a href="/register">Try again</a></h1></div>';
            res.send(errMessage);
        }
        else {
            passport.authenticate("local")(req,res,()=>{
                res.redirect(`/profile/${username}`);
            });
        }
    });
});
app.get("/about",(req,res)=>{
    res.render("about");
});
app.get("/contact",(req,res)=>{
    res.render("contact");
});
app.get("*",(req,res)=>{
    if(req.isAuthenticated()) {
        className = "show";
    }
});
app.use((req,res,next)=>{
    res.status(404).render("index");
});

app.listen(PORT,()=>{
    console.log(`Server is running at port ${PORT}`); 
});