import logger from "../server/logger";
import subCtrl from "../controllers/subreddit";
import request from "request";
import { RichEmbed } from "discord.js";
import utils from "../utils/utils";

function get(args, message) {
    const sub = args.shift();
    return subCtrl.getSubreddit(sub)
        .then(subSearched => {
            if (!subSearched) {
                sub ? utils.sendErrorEmbed(message, `No matching subreddit ${sub}, sorry ${utils.sadEmojiPicker()}\nDon't forget to use the search command if you're not sure`) : utils.sendErrorEmbed(message, `You need to provide a subreddit so I can get gifs and pics for you ${utils.sadEmojiPicker()}`);
            } else {
                let images = [];
                if (message.channel.nsfw) {
                    args.includes("bomb") ? getMedia(subSearched, args, message, images, 5) : getMedia(subSearched, args, message, images, 1);
                } else {
                    subSearched.nsfw ? utils.sendErrorEmbed(message, `Sorry it seems that you're in a SFW channel and you request a NSFW subreddit ${utils.sadEmojiPicker()}`) : args.includes("bomb") ? getMedia(subSearched, args, message, images, 5) : getMedia(subSearched, args, message, images, 1);
                }
            }
        })
        .catch(err => logger.error(err));
}

function getMedia(sub, args, message, images, length) {
    makeRequest(sub.name, function (imageURL) {
        if (imageURL == null) {
            utils.sendErrorEmbed(message, `Error while requesting ${sub}, sorry ${utils.sadEmojiPicker()}`);
        } else {
            if (args.includes("gif") && sub.canIGifIt) {
                images = images.concat(imageURL.filter(url => url.includes(".mp4") || url.includes(".webm")));
            } else if (args.includes("pic")) {
                images = images.concat(imageURL.find(url => url.includes(".jpg")));
            } else {
                images = images.concat(imageURL);
            }
            if (images.length >= length) {
                logger.info(`Request ${length} subreddit ${sub.name} ${utils.extractInfoFromMessage(message)}`);
                //message.channel.send(images.slice(0, length));
                const randomColor = utils.randomColor();
                images.slice(0, length).map(image => {
                    if (image.includes(".jpg")) {
                        const embed = new RichEmbed()
                            .setColor(randomColor)
                            .setImage(image);
                        message.channel.send({ embed });
                    } else {
                        message.channel.send(image);
                    }
                })
            } else {
                getMedia(sub, args, message, images, length);
            }
        }
    });
}

function makeRequest(sub, callback) {
    const HEADER = {
        "Content-Type": "application/json"
    };
    const TARGET_URL = `https://scrolller.com/api/random/${sub}`;
    const METHOD = "GET";
    request({
        headers: HEADER,
        url: TARGET_URL,
        method: METHOD,
    }, function (err, res, body) {
        if (err || res.statusCode != 200 || body.length < 1) {
            logger.error("Error while scraping scrolller.com ", JSON.stringify(body));
            callback(null);
        } else {
            callback(JSON.parse(body));
        }
    });
}


function search(args, message) {
    const sub = args[0];
    subCtrl.searchSubreddit(sub)
        .then(subs => {
            if (subs.length === 0) {
                utils.sendErrorEmbed(message, `No matching subreddit to your search "${sub}", sorry ${utils.sadEmojiPicker()}`);
            } else {
                logger.info(`Searched subreddit ${sub} ${subs.length} match found ${utils.extractInfoFromMessage(message)}`);
                const subsWithOnlyName = utils.extractName(subs, "!s ");
                const arrays = utils.divideInMultipleArrays(subsWithOnlyName, 30);
                const embeds = utils.divideInMultipleEmbed(arrays, 18);
                embeds.map((embed, index) => {
                    embed.setTitle(`Search ${index + 1}/${embeds.length} for subreddit : ${sub}`);
                    embed.setColor(utils.randomColor());
                    message.channel.send({ embed });
                });
            }
        })
        .catch(err => logger.error(err));
}

function info(args, message) {
    const sub = args[0];
    logger.info(`Info on subreddit ${sub} ${utils.extractInfoFromMessage(message)}`);
    subCtrl.getSubreddit(sub)
        .then(subFound => {
            if (!subFound) {
                utils.sendErrorEmbed(message, `No matching subreddit for info on "${sub}", sorry ${utils.sadEmojiPicker()}`);
                return;
            } else {
                makeRequest(subFound.name, function (imageURL) {
                    const thumbnail = !imageURL ? null : message.channel.nsfw ? imageURL.find(url => url.includes(".jpg")) : subFound.nsfw ? null : imageURL.find(url => url.includes(".jpg"));
                    const embed = new RichEmbed();
                    embed.setColor(utils.randomColor());
                    embed.setTitle(sub[0].toUpperCase() + sub.slice(1));
                    embed.setURL(`https://www.reddit.com/r/${sub}`);
                    embed.setDescription(subFound.title);
                    embed.setThumbnail(thumbnail);

                    subFound.description ? embed.addField("Description", subFound.description) : "embed.addBlankField() //Not so pretty :/";
                    embed.addField("Age", subFound.age, true);
                    embed.addField("Subscriber", subFound.subscriber, true);
                    thumbnail ? "" : embed.addField("\u200B", "\u200B", true);

                    embed.addField("Similar subreddit", subFound.similarSub.length == 0 ? "None 🤷" : utils.arrayToString(subFound.similarSub));

                    embed.addField("Pictures", subFound.nbPics, true);
                    embed.addField("Gifs", subFound.nbGifs, true);
                    embed.addField("NSFW", subFound.nsfw ? "Totally NSFW" : "Nah, SFW", true);

                    embed.addField("Category", subFound.categoryName.length == 0 ? "Not in a category sorry 😕" : utils.arrayToString(subFound.categoryName), true);
                    embed.addField("Related category", subFound.relatedCategory.length == 0 ? "No related category sorry 😞" : utils.arrayToString(subFound.relatedCategory), true);

                    message.channel.send({ embed });
                });
            }
        })
        .catch(err => logger.error(err));
}

export default {
    get,
    search,
    info,
};
