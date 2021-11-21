const express = require('express');
const cookieParser = require('cookie-parser');
const sessions = require('express-session');
const app = express();
const port = process.env.PORT || 5000;
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const one_day = 1000 * 60 * 60 * 24;
app.use(sessions({
    secret: "aprycotsecretkeyforsession",
    saveUninitialized: true,
    cookie: { maxAge: one_day },
    resave: false
}));

app.listen(port, () => console.log(`Listening on port ${port}`));

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());

app.post('/gg_auth', (req, res) => { // login (signin and signup) with google 
    const gg_auth = require('./google_auth');
    gg_auth(req.body.tokenId).then((response) => {
        console.log("Response from gg_auth: ", response);
        const filename = '../client/src/data/user.json';
        let file = fs.readFileSync(filename, {encoding: "utf8"});
        let cont = JSON.parse(file);
        let username = response["email"].split("@")[0]; // solit username from email
        for (let i = 0; i < cont.length; i++) {
            if (response["email"] === cont[i]["email"]) {
                let session = req.session;
                session.userid = username;
                console.log("GG auth: ", req.session);
                res.send({info: {
                    "fname": cont[i]["fname"],
                    "lname": cont[i]["lname"],
                    "email": cont[i]["email"],
                    "role": cont[i]["role"],
                    "avatar": cont[i]["avatar"],
                    }
                });
                return;
            }
        }
        let user_data = {
            "fname": response["fname"],
            "lname": response["lname"],
            "username": username,
            "password": "none",
            "phone": "",
            "email": response["email"],
            "role": "1",
            "avatar": response["photoUrl"]
        };
        cont.push(user_data);
        fs.writeFileSync(filename, JSON.stringify(cont), {encoding: "utf8"}); // write file
        let session = req.session;
        session.userid = username;
        console.log("GG auth not yet: ", req.session);
        res.send({info: response});
    });
});

app.post('/forgot-pass', (req, res) => { // forgot pass and resetting pass
    let info = req.body; // user data from frontend
    const filename = '../client/src/data/user.json';
    let file = fs.readFileSync(filename, {encoding: "utf8"});
    let cont = JSON.parse(file);
    for (let i = 0; i < cont.length; i++) {
        if (info["email"] === cont[i]["email"]) {
            // TODO send mail
            res.send({succ: true});
            return;
        }
    }
    res.send({succ: false});
});

app.post('/signin', (req, res) => { // sign in by form
    let info = req.body; // user data from frontend
    const filename = '../client/src/data/user.json';
    let file = fs.readFileSync(filename, {encoding: "utf8"});
    let cont = JSON.parse(file);
    let username = info["username"];
    username = username.split('@')[0]; // split username from email if needed
    for (let i = 0; i < cont.length; i++) {
        if (username === cont[i]["username"]) {
            if (cont[i]["password"] !== "none" && bcrypt.compareSync(info["password"], cont[i]["password"])) {
                let session = req.session;
                session.userid = username;
                console.log(req.session);
                res.send({
                    succ: true,
                    data: {
                        "fname": cont[i]["fname"],
                        "lname": cont[i]["lname"],
                        "email": cont[i]["email"],
                        "role": cont[i]["role"],
                        "avatar": cont[i]["avatar"],
                    }
                });
                return;
            } else {
                res.send({succ: false});
                return;
            }
        }
    }
    res.send({succ: false});
});

app.post('/signup', (req, res) => { // signup
    const filename = '../client/src/data/user.json';
    let info = req.body; // user data from frontend
    let file = fs.readFileSync(filename, {encoding: "utf8"}); // read file
    let cont = JSON.parse(file);
    for (let i = 0; i < cont.length; i++) {
        var data = cont[i];
        if (data["email"] === info["email"]) { // account existed
            console.log("Duplicated");
            res.send({succ: false});
            return;
        }
    }
    let fullname = info["fullname"];
    let email = info["email"];
    let password = info["password"];
    let name_split = fullname.split(" ");
    let lname = ''; // Last name
    let fname = ''; // First name
    if (name_split.length === 1) { // name contains one word
        lname = name_split[0];
        fname = name_split[1];
        let count = 2;
        while (name_split[count] != null) { // Add remains to first name
            fname += " " + name_split[count];
            count++;
        }
    } else {
        fname = name_split[0];
    }
    let username = email.split("@")[0]; // username
    password = bcrypt.hashSync(password, 10);
    let user_data = {
        "fname": fname,
        "lname": lname,
        "username": username,
        "password": password,
        "phone": "",
        "email": email,
        "role": "1",
        "avatar": ""
    };
    cont.push(user_data);
    fs.writeFileSync(filename, JSON.stringify(cont), {encoding: "utf8"}); // write file
    res.send({succ: true});
});

app.post('/get-user-info', (req, res) => { // get user info
    const filename = '../client/src/data/user.json';
    let info = req.body; // user info from frontend
    let file = fs.readFileSync(filename, {encoding: "utf8"});
    let cont = JSON.parse(file);
    for (let i = 0; i < cont.length; i++) {
        var data = cont[i];
        if (data["email"] === info["email"]) {
            let has_pass = (data["password"] !== "none");
            res.send({
                succ: true,
                info: {
                    "username": data["username"],
                    "lname": data["lname"],
                    "fname": data["fname"],
                    "email": data["email"],
                    "phone": data["phone"],
                },
                "haspass": has_pass
            });
            return;
        }
    }
    res.send({succ: false});
});

app.post('/change-info', (req, res) => { // update changed info
    const filename = '../client/src/data/user.json';
    let info = req.body; // user info from frontend
    let file = fs.readFileSync(filename, {encoding: "utf8"});
    let cont = JSON.parse(file);
    let count_position = -1;
    for (let i = 0; i < cont.length; i++) {
        var data = cont[i];
        if ((data["email"] === info["email"] || data["phone"] === info["phone"]) && data["phone"] !== "" && info["phone"] !== "") {
            if (data["username"] === info["username"]) {
                count_position = i;
                continue;
            } else {
                res.send({succ: false});
                return;
            }
        }
        if (data["username"] === info["username"]) {
            count_position = i;
            continue;
        }
    }
    if (count_position === -1) {
        res.send({succ: false});
        return;
    }
    if (cont[count_position]["email"] !== info["email"]) {
        cont[count_position]["email"] = info["email"];
        // TODO send mail
    }
    if (cont[count_position]["phone"] !== info["phone"]) {
        cont[count_position]["phone"] = info["phone"];
        // TODO send mail
    }
    if (cont[count_position]["fname"] !== info["fname"]) cont[count_position]["fname"] = info["fname"];
    if (cont[count_position]["lname"] !== info["lname"]) cont[count_position]["lname"] = info["lname"];
    fs.writeFileSync(filename, JSON.stringify(cont), {encoding: "utf8"}); // write file
    res.send({
        succ: true,
        info: {
            username: cont[count_position]["username"],
            lname: cont[count_position]["lname"],
            fname: cont[count_position]["fname"],
            email: cont[count_position]["email"],
            phone: cont[count_position]["phone"]
        }
    });
});

app.post('/change-password', (req, res) => { // update changed password
    const filename = '../client/src/data/user.json';
    let info = req.body; // user info from frontend
    let file = fs.readFileSync(filename, {encoding: "utf8"});
    let cont = JSON.parse(file);
    let username = req.session.userid;
    for (let i = 0; i < cont.length; i++) {
        if (cont[i]["password"] === "none" || (cont[i]["username"] === username && bcrypt.compareSync(info["oldpass"], cont[i]["password"]))) {
            cont[i]["password"] = bcrypt.hashSync(info["newpass"], 10);
            fs.writeFileSync(filename, JSON.stringify(cont), {encoding: "utf8"});
            // TODO send mail
            res.send({succ: true});
            return;
        } else {
            res.send({succ: false});
            return;
        }
    }
    res.send({succ: false});
});

app.post('/logout', (req, res) => { // logout
    req.session.destroy();
    res.end();
});

app.get('/verify', (req, res) => { // verify session
    let session = req.session;
    console.log(req.session);
    if (session.userid === undefined) {
        console.log("Username is undefined!");
        res.send({succ: false});
        return;
    } else {
        const filename = '../client/src/data/user.json';
        let file = fs.readFileSync(filename, {encoding: "utf8"});
        let cont = JSON.parse(file);
        for (let i = 0; i < cont.length; i++) {
            let data = cont[i];
            if (session.userid === data["username"]) {
                console.log("OK");
                res.send({
                    succ: true,
                    data: {
                        "fname": data["fname"],
                        "lname": data["lname"],
                        "email": data["email"],
                        "role": data["role"],
                        "avatar": data["avatar"],
                    }
                });
                return;
            }
        }
        console.log("Not undefined but username not found!");
        res.send({succ: false});
        return;
    }
});

app.use(express.static(path.join(__dirname, '../client/build'))); // root ('/')

app.get('*', function(req, res) { // other routes not defined above
    console.log("In get *");
    res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
    console.log("End get *");
});

app.use(function(req, res, next) {
    res.status(404).send('<h1>Nothing found</h1>');
});