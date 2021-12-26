import { ObjectType, Field } from "type-graphql";
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from "typeorm";
import { Author } from "./author.entity";

@ObjectType()
@Entity()
export class Book {
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  @Field()
  @Column()
  title!: string;

  @Field(() => Author)
  @ManyToOne(() => Author, (author) => author.books, { onDelete: "CASCADE" })
  author!: Author;

  @Field()
  @CreateDateColumn({ type: "timestamp" })
  createdAt!: string;

  @Field(() => Boolean, { nullable: true })
  @Column({ type: Boolean, nullable: true })
  isOnLoan!: boolean;

  @Field(() => Number, { nullable: true })
  @Column({ type: Number, nullable: true })
  userId!: number;

  @Field()
  @Column({ nullable: true })
  loanedAt!: Date;
}
