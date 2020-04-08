const express = require('express');
const router = new express.Router();
const User = require('../models/user');
const auth = require('../middleware/auth');
const multer = require('multer');
const sharp = require('sharp');
const { sendWelcomeEmail, sendCancelationEmail } = require('../emails/account');

// Create User
router.post('/users', async (req, res) => {
    const user = new User(req.body);

    try {
        await user.save();
        sendWelcomeEmail(user.email, user.name);
        const token = await user.generateAuthToken();
        res.status(201).send({user, token});
    } catch(error) {
        res.status(400).send(error);
    }
});

// For Login
router.post('/users/login', async (req, res) => {

    try {
        const user = await User.findByCredentials(req.body.email, req.body.password);
        const token = await user.generateAuthToken();
        res.send({user, token});
    } catch(error) {
        res.status(400).send(error);
    }
});

// For Logout
router.post('/users/logout', auth, async (req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token !== req.token;
        })
        await req.user.save();

        res.send('Logged Out');
    } catch(error) {
        res.status(500).send(error);
    }
});

// For Logout for all accounts
router.post('/users/logoutAll', auth, async (req, res) => {
    try {
        req.user.tokens = [];
        await req.user.save();

        res.send('Logged Out of All accounts');
    } catch(error) {
        res.status(500).send(error);
    }
});

// Read Profile of Loged In user
router.get('/users/me', auth, async (req, res) => {
    res.send(req.user);
});

// Read User By Id
// router.get('/users/:id', async (req, res) => {
//     const _id = req.params.id;

//     try{
//         const user = await User.findById(_id);

//         if(!user) {
//             return res.status(404).send();
//         }
//         res.send(user);
//     } catch(error) {
//         res.status(500).send(error);
//     }
// });

// Update User
router.patch('/users/me', auth,  async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ["name", "email", "password", "age"];
    const isValidOperation = updates.every((update) => {
        return allowedUpdates.includes(update);
    });

    if(!isValidOperation) {
        return res.status(400).send({error: 'Invalid updates!'});
    }

    try {
        updates.forEach((update) => {
            req.user[update] = req.body[update];
        });
        
        await req.user.save();

        // if(!user) {
        //    return res.status(404).send();
        // }
        res.send(req.user);
    } catch(error) {
        res.status(400).send(error);
    }
});

// Delete User
router.delete('/users/me', auth, async (req, res) => {
    try {
        // const user = await User.findByIdAndDelete(req.user._id);

        // if(!user) {
        //     return res.status(404).send();
        // }
        await req.user.remove();
        sendCancelationEmail(req.user.email, req.user.name);
        res.send(req.user);
    } catch(error) {
        res.status(500).send(error);
    }
});

// Uploading File
const upload = multer({
    limits: {
        fileSize: 1000000      //In bytes 10^6 bytes = 1MB
    },
    fileFilter(req, file, cb) {
        if(!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Please upload an image'));
        }

        cb(undefined, true);
    }
})
router.post('/users/me/avatar', auth, upload.single('avatar'), async (req, res) => {
    const buffer = await sharp(req.file.buffer).resize({width: 250, height: 250}).png().toBuffer();
    req.user.avatar = buffer;
    await req.user.save();
    res.send();
}, (error, req, res, next) => {
    res.status(400).send({error: error.message})
});

// Deleting File
router.delete('/users/me/avatar', auth, async (req, res) => {
    req.user.avatar = undefined;
    await req.user.save();
    res.send();
})

// Fetching File
router.get('/users/:id/avatar', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if(!user || !user.avatar) {
            throw new Error();
        }

        res.set('Content-Type', 'image/png');
        res.send(user.avatar);
    } catch(error) {
        res.status(404).send();
    }
});

module.exports = router;