import {
  Mutation,
  Resolver,
  Arg,
  InputType,
  Field,
  Query,
  UseMiddleware,
  Ctx,
  ID,
} from "type-graphql";
import { Any, getRepository, Repository } from "typeorm";
import { Author } from "../entity/author.entity";
import { Book } from "../entity/book.entity";
import { Length } from "class-validator";
import { IContext, isAuth } from "../middlewares/auth.middleware";
import { isAuthAdmin } from "../middlewares/authAdmin.middleware";
import { User } from "../entity/user.entity";

@InputType()
class BookInput {
  @Field()
  @Length(3, 64)
  title!: string;

  @Field(() => Number)
  author!: number;
}

@InputType()
class BookUpdateInput {
  @Field(() => String, { nullable: true })
  @Length(3, 64)
  title?: string;

  @Field(() => Number, { nullable: true })
  author?: number;
}

@InputType()
class BookUpdateParsedInput {
  @Field(() => String, { nullable: true })
  @Length(3, 64)
  title?: string;

  @Field(() => Author, { nullable: true })
  author?: Author;
}

@InputType()
class BookIdInput {
  @Field(() => Number)
  id!: number;
}

@Resolver()
export class BookResolver {
  bookRepository: Repository<Book>;
  authorRepository: Repository<Author>;
  userRepository: Repository<User>;

  constructor() {
    this.bookRepository = getRepository(Book);
    this.authorRepository = getRepository(Author);
    this.userRepository = getRepository(User);
  }

  @Mutation(() => Book)
  @UseMiddleware(isAuthAdmin)
  async createBook(
    @Arg("input", () => BookInput) input: BookInput,
    @Ctx() context: IContext
  ) {
    try {
      const author: Author | undefined = await this.authorRepository.findOne(
        input.author
      );

      if (!author) {
        const error = new Error();
        error.message =
          "The author for this book does not exist, please double check";
        throw error;
      }

      const book = await this.bookRepository.insert({
        title: input.title,
        author: author,
      });

      return await this.bookRepository.findOne(book.identifiers[0].id, {
        relations: ["author", "author.books"],
      });
    } catch (e) {
      throw new Error(e.message);
    }
  }

  @Query(() => [Book])
  @UseMiddleware(isAuthAdmin)
  async getAllBooks(): Promise<Book[]> {
    try {
      return await this.bookRepository.find({
        relations: ["author", "author.books"],
      });
    } catch (e) {
      throw new Error(e);
    }
  }

  @Query(() => Book)
  @UseMiddleware(isAuth)
  async getBookById(
    @Arg("input", () => BookIdInput) input: BookIdInput,
    @Ctx() context: IContext
  ): Promise<Book | undefined> {
    try {
      console.log(context.payload);
      const book = await this.bookRepository.findOne(input.id, {
        relations: ["author"],
      });
      if (!book) {
        const error = new Error();
        error.message = "Book not found";
        throw error;
      }

      return book;
    } catch (e) {
      throw new Error(e);
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuthAdmin)
  async updateBookById(
    @Arg("bookId", () => BookIdInput) bookId: BookIdInput,
    @Arg("input", () => BookUpdateInput) input: BookUpdateInput
  ): Promise<Boolean> {
    try {
      await this.bookRepository.update(bookId.id, await this.parseInput(input));
      return true;
    } catch (e) {
      throw new Error(e);
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuthAdmin)
  async deleteBook(
    @Arg("bookId", () => BookIdInput) bookId: BookIdInput
  ): Promise<Boolean> {
    try {
      const result = await this.bookRepository.delete(bookId.id);

      if (result.affected === 0) throw new Error("Book does not exist");

      return true;
    } catch (e) {
      throw new Error(e);
    }
  }

  private async parseInput(input: BookUpdateInput) {
    try {
      const _input: BookUpdateParsedInput = {};

      if (input.title) {
        _input["title"] = input.title;
      }

      if (input.author) {
        const author = await this.authorRepository.findOne(input.author);
        if (!author) {
          throw new Error("This author does not exist");
        }
      }

      return _input;
    } catch (e) {
      throw new Error(e);
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async getBookOnLoan(
    @Arg("input", () => BookIdInput) bookId: BookIdInput,
    @Ctx() context: IContext
  ): Promise<Boolean | undefined> {
    try {
      const conectedUserPayload = context.payload;
      const conectedUserPayloadValues = Object.values(conectedUserPayload);
      const conectedUserId = conectedUserPayloadValues[0];
      const conectedUserIdParsed = Number(conectedUserId);
      const bookToLoan: any = await this.bookRepository.findOne(bookId.id);
      if (!bookToLoan) throw new Error("Book does not exist");

      if (bookToLoan.isOnLoan === true) {
        throw new Error("Book is already on loan");
      }
      const findUser = await this.userRepository.findOne(conectedUserId);
      const quantityLimitOfBorrowedBooks = findUser?.loanedBooksQuantity;
      console.log(quantityLimitOfBorrowedBooks);
      const quantityLimitOfBorrowedBooksParsed = Number(
        quantityLimitOfBorrowedBooks
      );
      const quantityLimitOfBorrowedBooksExceeded =
        quantityLimitOfBorrowedBooksParsed >= 3;
      if (quantityLimitOfBorrowedBooksExceeded)
        throw new Error(
          "You can't borrow another book until you return one book, because the limit of books on loan at the same time is three (3)"
        );
      await this.bookRepository.update(bookId.id, { isOnLoan: true });
      await this.userRepository.update(conectedUserId, {
        loanedBooksQuantity: quantityLimitOfBorrowedBooksParsed + 1,
      });
      await this.bookRepository.update(bookId.id, {
        userId: conectedUserIdParsed,
      });
      const currentDate = new Date();
      const loanedAtDate = await this.bookRepository.update(bookId.id, {
        loanedAt: currentDate,
      });
      return true;
    } catch (e) {
      throw new Error(e);
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async returnBookOnLoan(
    @Arg("input", () => BookIdInput) BookId: BookIdInput,
    @Ctx() context: IContext
  ): Promise<Boolean | string> {
    try {
      const conectedUserPayloadReturn = context.payload;
      const conectedUserPayloadValuesToReturn = Object.values(
        conectedUserPayloadReturn
      );
      const conectedUserIdToReturn = conectedUserPayloadValuesToReturn[0];
      const conectedUserIdToReturnParsed = Number(conectedUserIdToReturn);

      const bookToReturn: any = await this.bookRepository.findOne(BookId.id);
      if (!bookToReturn) throw new Error("Book does not exist");
      const bookIsNotOnLoan: any = bookToReturn.isOnLoan !== true;
      if (bookIsNotOnLoan) throw new Error("Book is not on loan");

      const bookToReturnDataUserParsed = Number(bookToReturn.userId);
      const isTheSameUser =
        conectedUserIdToReturnParsed === bookToReturnDataUserParsed;
      if (!isTheSameUser)
        throw new Error("You cannot return this book, as you didn't borrow it");
      const userData = await this.userRepository.findOne(
        conectedUserIdToReturn
      );
      const quantityOfLoanedBooks = userData?.loanedBooksQuantity;
      const quantityOfLoanedBooksParsed = Number(quantityOfLoanedBooks);

      await this.bookRepository.update(BookId.id, { isOnLoan: false });
      await this.userRepository.update(conectedUserIdToReturn, {
        loanedBooksQuantity: quantityOfLoanedBooksParsed - 1,
      });
      const loanedDate = await this.bookRepository.findOne(BookId.id);
      if (loanedDate) {
        const loanDateOk = loanedDate.loanedAt;
        const parsedLoanDateOk = loanDateOk.getTime();
        const currentDate1 = new Date();
        const parsedCurrentDate1 = currentDate1.getTime();
        if (parsedCurrentDate1 >= parsedLoanDateOk + 1000) {
          const message =
            "You must pay a fine, of 1 USD for each day of delay, as you returned the book after the limit of seven days";
          return message;
        } else {
          return true;
        }
      } else {
        return true;
      }
    } catch (e) {
      throw new Error(e);
    }
  }

  @Query(() => [Book])
  @UseMiddleware(isAuth)
  async getBooksForUsers(): Promise<Book[]> {
    try {
      const booksUsers = await this.bookRepository.find({
        relations: ["author", "author.books"],
      });
      const filteredBookUsers = booksUsers.filter(
        (item) => item.isOnLoan !== true
      );

      return filteredBookUsers;
    } catch (e) {
      throw new Error(e);
    }
  }

  @Query(() => [Book])
  @UseMiddleware(isAuth)
  async getBooksOnLoanReport(): Promise<Book[]> {
    try {
      const allBooks = await this.bookRepository.find({
        relations: ["author", "author.books"],
      });
      const filteredLoanedBooks = allBooks.filter(
        (item) => item.isOnLoan === true
      );

      return filteredLoanedBooks;
    } catch (e) {
      throw new Error(e);
    }
  }
}

module.exports = { BookResolver };
