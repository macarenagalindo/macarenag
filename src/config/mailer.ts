const nodemailer = require("nodemailer");
import { getRepository } from "typeorm";
import { Book } from "../entity/book.entity";

const transporter = nodemailer.createTransport({
  service: "hotmail",
  auth: {
    user: "macarenagalindo21@outlook.com",
    pass: "galindo21",
  },
});
export const sendEmailJob = async () => {
  try {
    const bookRepository = getRepository(Book);
    const bookUsers = await bookRepository.find({
      relations: ["author", "author.books"],
    });
    const filteredLoanedBooks = bookUsers.filter(
      (item) => item.isOnLoan === true
    );

    const options = {
      from: "macarenagalindo21@outlook.com",
      to: "macarenagalindo21@gmail.com",
      subject: "Weekly report",
      text: `Hola ${JSON.stringify(filteredLoanedBooks, undefined, 4)}`,
    };

    transporter.sendMail(options, function (err: any, info: any) {
      if (err) {
        console.log(err);
        return;
      }
      console.log("Sent: " + info.response);
    });
  } catch (e) {
    throw new Error(e);
  }
};
